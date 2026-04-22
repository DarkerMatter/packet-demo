#![no_std]
#![no_main]

use esp_hal::{
    clock::CpuClock,
    gpio::{Input, InputConfig, Level, Output, OutputConfig, Pull},
    interrupt::software::SoftwareInterruptControl,
    rng::Rng,
    timer::timg::TimerGroup,
};
use esp_backtrace as _;
esp_bootloader_esp_idf::esp_app_desc!();
use esp_println::println;
use esp_radio::esp_now::{EspNow, BROADCAST_ADDRESS};
use pqxdh_shared::{
    frame::{self, DecodedMessage, Frame, Reassembler, ReassemblyResult},
    pqxdh::{AliceIdentity, AliceSession, HandshakeMode},
    wire,
};

/// Wrapper around esp-hal Rng that implements CryptoRng for rand_core 0.6.
/// The ESP32-C3 hardware RNG is crypto-grade when WiFi/BT is active.
struct EspCryptoRng(Rng);

impl rand_core::RngCore for EspCryptoRng {
    fn next_u32(&mut self) -> u32 {
        <Rng as rand_core::RngCore>::next_u32(&mut self.0)
    }
    fn next_u64(&mut self) -> u64 {
        <Rng as rand_core::RngCore>::next_u64(&mut self.0)
    }
    fn fill_bytes(&mut self, dest: &mut [u8]) {
        <Rng as rand_core::RngCore>::fill_bytes(&mut self.0, dest)
    }
    fn try_fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), rand_core::Error> {
        <Rng as rand_core::RngCore>::try_fill_bytes(&mut self.0, dest)
    }
}
impl rand_core::CryptoRng for EspCryptoRng {}

#[derive(Clone, Copy, PartialEq)]
enum LedState {
    Idle,
    Handshaking,
    Established,
    TouchFlash,
    Error,
}

enum AppState {
    WaitingForBundle,
    HandshakeComplete(AliceSession),
}

static mut MSG_ID_COUNTER: u16 = 0;
fn next_msg_id() -> u16 {
    unsafe {
        MSG_ID_COUNTER = MSG_ID_COUNTER.wrapping_add(1);
        MSG_ID_COUNTER
    }
}

fn log_send(esp_now: &mut EspNow<'_>, msg: &[u8]) {
    // Print locally (visible when USB-connected for debug)
    if let Ok(s) = core::str::from_utf8(msg) {
        println!("[USV] {}", s);
    }
    // Relay log to Bob via ESP-NOW
    let mut relay = pqxdh_shared::pqxdh::LogRelay {
        message: heapless::Vec::new(),
    };
    let _ = relay.message.extend_from_slice(&msg[..msg.len().min(200)]);
    let encoded = relay.encode();
    let frames = frame::fragment(wire::MSG_LOG_RELAY, next_msg_id(), &encoded);
    for f in frames.iter() {
        let raw = f.encode();
        let _ = esp_now.send(&BROADCAST_ADDRESS, &raw).map(|w| w.wait());
    }
}

#[esp_hal::main]
fn main() -> ! {
    let config = esp_hal::Config::default().with_cpu_clock(CpuClock::max());
    let peripherals = esp_hal::init(config);

    // Init heap allocator (required by WiFi stack)
    esp_alloc::heap_allocator!(size: 72 * 1024);

    // Init RTOS scheduler (required before esp-radio)
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    let sw_ints = SoftwareInterruptControl::new(peripherals.SW_INTERRUPT);
    esp_rtos::start(timg0.timer0, sw_ints.software_interrupt0);

    // Init radio + ESP-NOW
    let mut rng = EspCryptoRng(Rng::new());
    let radio_ctrl = esp_radio::init().expect("Radio init failed");
    let (mut wifi_ctrl, interfaces) =
        esp_radio::wifi::new(&radio_ctrl, peripherals.WIFI, Default::default())
            .expect("WiFi new failed");
    wifi_ctrl
        .set_mode(esp_radio::wifi::WifiMode::Sta)
        .expect("WiFi set mode failed");
    wifi_ctrl.start().expect("WiFi start failed");
    let mut esp_now = interfaces.esp_now;

    // Print MAC
    let mac = esp_radio::wifi::sta_mac();
    println!(
        "[USV] MAC: {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]
    );

    // GPIO: LED on D0/GPIO2, touch sensor on D10/GPIO10
    let mut led = Output::new(peripherals.GPIO2, Level::Low, OutputConfig::default());
    let button = Input::new(
        peripherals.GPIO10,
        InputConfig::default().with_pull(Pull::Down),
    );

    // Generate Alice identity
    log_send(&mut esp_now, b"Generating identity keys...");
    let alice_id = AliceIdentity::generate(&mut rng);
    log_send(&mut esp_now, b"Identity ready. Waiting for Ground Station's prekey bundle...");

    let mut reassembler = Reassembler::new(2000);
    let mut state = AppState::WaitingForBundle;
    let mut led_state = LedState::Idle;
    let mut led_on = false;
    let mut tick: u32 = 0;

    // Button debounce: 3 consecutive HIGH reads at 10ms apart
    let mut debounce_count: u8 = 0;
    let mut debounce_tick: u32 = 0;
    let mut button_was_pressed = false;

    let mut touch_blinks_left: u32 = 0;
    let mut touch_blink_tick: u32 = 0;

    let mode = HandshakeMode::Hybrid;

    loop {
        tick = tick.wrapping_add(1);

        // --- LED pattern ---
        match led_state {
            LedState::Idle => {
                // Slow pulse: 1 Hz, ~20% duty
                let phase = tick % 1000;
                if phase < 200 && !led_on {
                    led.set_high();
                    led_on = true;
                } else if phase >= 200 && led_on {
                    led.set_low();
                    led_on = false;
                }
            }
            LedState::Handshaking => {
                // Fast pulse: 8 Hz, 50% duty
                let phase = tick % 125;
                if phase < 62 && !led_on {
                    led.set_high();
                    led_on = true;
                } else if phase >= 62 && led_on {
                    led.set_low();
                    led_on = false;
                }
            }
            LedState::Established => {
                if !led_on {
                    led.set_high();
                    led_on = true;
                }
            }
            LedState::TouchFlash => {
                if touch_blinks_left > 0 {
                    let phase = tick.wrapping_sub(touch_blink_tick) % 50;
                    if phase < 25 && !led_on {
                        led.set_high();
                        led_on = true;
                    } else if phase >= 25 && led_on {
                        led.set_low();
                        led_on = false;
                        touch_blinks_left -= 1;
                    }
                } else {
                    led_state = LedState::Established;
                }
            }
            LedState::Error => {
                // SOS pattern
                let phase = tick % 3000;
                let on = matches!(
                    phase,
                    0..=99
                        | 200..=299
                        | 400..=499
                        | 700..=1099
                        | 1300..=1699
                        | 1900..=2299
                        | 2500..=2599
                        | 2700..=2799
                        | 2900..=2999
                );
                if on && !led_on {
                    led.set_high();
                    led_on = true;
                } else if !on && led_on {
                    led.set_low();
                    led_on = false;
                }
            }
        }

        // --- Button debounce ---
        let button_pressed = {
            let high = button.is_high();
            if high {
                if tick.wrapping_sub(debounce_tick) >= 10 {
                    debounce_count = debounce_count.saturating_add(1);
                    debounce_tick = tick;
                }
            } else {
                debounce_count = 0;
            }
            let pressed = debounce_count >= 3 && !button_was_pressed;
            if debounce_count >= 3 {
                button_was_pressed = true;
            }
            if !high {
                button_was_pressed = false;
            }
            pressed
        };

        // --- Receive ESP-NOW ---
        if let Some(received) = esp_now.receive() {
            println!("[USV] RX {} bytes from {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
                received.data().len(),
                received.info.src_address[0], received.info.src_address[1],
                received.info.src_address[2], received.info.src_address[3],
                received.info.src_address[4], received.info.src_address[5]);
            if let Some(f) = Frame::decode(received.data()) {
                match reassembler.feed(&f, tick) {
                    ReassemblyResult::Complete(msg_type, data) => {
                        handle_message(
                            msg_type,
                            &data,
                            &alice_id,
                            &mut state,
                            &mut led_state,
                            &mut esp_now,
                            &mut rng,
                            mode,
                        );
                    }
                    _ => {}
                }
            }
        }

        // --- Button press ---
        if button_pressed {
            match state {
                AppState::WaitingForBundle => {
                    log_send(&mut esp_now, b"Button pressed, no bundle yet...");
                }
                AppState::HandshakeComplete(ref mut session) => {
                    led_state = LedState::TouchFlash;
                    touch_blinks_left = 3;
                    touch_blink_tick = tick;

                    match session.encrypt(b"ping") {
                        Ok(msg) => {
                            let encoded = msg.encode();
                            let frames = frame::fragment(
                                wire::MSG_SESSION_MESSAGE,
                                next_msg_id(),
                                &encoded,
                            );
                            for f in frames.iter() {
                                let raw = f.encode();
                                let _ = esp_now
                                    .send(&BROADCAST_ADDRESS, &raw)
                                    .map(|w| w.wait());
                            }
                            log_send(&mut esp_now, b"Sent encrypted ping");
                        }
                        Err(_) => {
                            log_send(&mut esp_now, b"Encrypt failed");
                        }
                    }
                }
            }
        }

        // Brief spin to yield
        for _ in 0..1000 {
            core::hint::spin_loop();
        }
    }
}

fn handle_message(
    msg_type: u8,
    data: &[u8],
    alice_id: &AliceIdentity,
    state: &mut AppState,
    led_state: &mut LedState,
    esp_now: &mut EspNow<'_>,
    rng: &mut EspCryptoRng,
    mode: HandshakeMode,
) {
    match DecodedMessage::from_reassembled(msg_type, data) {
        Ok(DecodedMessage::PrekeyBundle(bundle)) => {
            if !matches!(state, AppState::WaitingForBundle) {
                return;
            }
            log_send(esp_now, b"Received Ground Station's prekey bundle");
            *led_state = LedState::Handshaking;

            log_send(esp_now, b"Running PQXDH handshake...");
            match alice_id.process_prekey_bundle(&bundle, mode, b"hello bob!", rng) {
                Ok((session, initial_msg)) => {
                    let encoded = initial_msg.encode();
                    let frames =
                        frame::fragment(wire::MSG_INITIAL_MESSAGE, next_msg_id(), &encoded);
                    for f in frames.iter() {
                        let raw = f.encode();
                        let _ = esp_now.send(&BROADCAST_ADDRESS, &raw).map(|w| w.wait());
                    }

                    if mode == HandshakeMode::ClassicalOnly {
                        log_send(esp_now, b"Handshake complete (CLASSICAL ONLY)");
                    } else {
                        log_send(esp_now, b"Handshake complete (HYBRID: X25519 + ML-KEM-768)");
                    }

                    *state = AppState::HandshakeComplete(session);
                    *led_state = LedState::Established;
                }
                Err(_) => {
                    log_send(esp_now, b"Handshake FAILED");
                    *led_state = LedState::Error;
                }
            }
        }
        Ok(DecodedMessage::SessionMessage(msg)) => {
            if let AppState::HandshakeComplete(ref mut session) = state {
                match session.decrypt(&msg) {
                    Ok(pt) => {
                        let text = core::str::from_utf8(&pt).unwrap_or("<binary>");
                        println!("[USV] Received: {}", text);
                    }
                    Err(_) => {
                        log_send(esp_now, b"Decrypt failed");
                    }
                }
            }
        }
        _ => {}
    }
}
