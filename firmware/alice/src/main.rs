#![no_std]
#![no_main]

use esp_hal::{
    clock::CpuClock,
    gpio::{Input, InputConfig, Level, Output, OutputConfig, Pull},
    rng::Rng,
    timer::timg::TimerGroup,
};
use esp_println::println;
use esp_wifi::esp_now::{EspNow, BROADCAST_ADDRESS};
use pqxdh_shared::{
    frame::{self, Frame, Reassembler, ReassemblyResult, DecodedMessage},
    pqxdh::{AliceIdentity, AliceSession, HandshakeMode},
    wire,
};

// --- Pin assignments for XIAO ESP32-C3 ---
// Touch sensor: GPIO10 (D10) — digital HIGH when touched
// LED: GPIO2 (D0) — change if your board's LED is on a different pin
const LED_PIN: u8 = 2;

// --- LED pattern state ---
#[derive(Clone, Copy, PartialEq)]
enum LedState {
    Idle,
    Handshaking,
    Established,
    TouchFlash(u32), // remaining blink count
    Error,
}

// --- Application state ---
enum AppState {
    WaitingForBundle,
    HandshakeComplete(AliceSession),
}

/// Simple tick counter (incremented in main loop, ~1ms per tick with busy loop).
static mut TICK: u32 = 0;

fn log_send(esp_now: &mut EspNow<'_>, msg: &str) {
    println!("[ALICE] {}", msg);
    // Relay log to Bob via ESP-NOW
    let mut log_msg = pqxdh_shared::pqxdh::LogRelay {
        message: heapless::Vec::new(),
    };
    let formatted = msg.as_bytes();
    let _ = log_msg.message.extend_from_slice(&formatted[..formatted.len().min(200)]);
    let encoded = log_msg.encode();
    let frames = frame::fragment(wire::MSG_LOG_RELAY, next_msg_id(), &encoded);
    for f in frames.iter() {
        let raw = f.encode();
        let _ = esp_now.send(&BROADCAST_ADDRESS, &raw).map(|w| w.wait());
    }
}

static mut MSG_ID_COUNTER: u16 = 0;
fn next_msg_id() -> u16 {
    unsafe {
        MSG_ID_COUNTER = MSG_ID_COUNTER.wrapping_add(1);
        MSG_ID_COUNTER
    }
}

#[esp_hal::main]
fn main() -> ! {
    let config = esp_hal::Config::default().with_cpu_clock(CpuClock::max());
    let peripherals = esp_hal::init(config);

    // Timer + RNG for WiFi stack
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    let mut rng = Rng::new(peripherals.RNG);
    let init = esp_wifi::init(timg0.timer0, Rng::new(peripherals.RNG), peripherals.RADIO_CLK)
        .expect("WiFi init failed");

    let (_wifi_ctrl, interfaces) = esp_wifi::wifi::new(&init, peripherals.WIFI)
        .expect("WiFi new failed");
    let mut esp_now = interfaces.esp_now;

    // Print MAC address
    let mut mac = [0u8; 6];
    esp_wifi::wifi::sta_mac(&mut mac);
    println!("[ALICE] MAC: {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    // GPIO setup
    let mut led = Output::new(peripherals.GPIO2, Level::Low, OutputConfig::default());
    let button = Input::new(peripherals.GPIO10, InputConfig::default().with_pull(Pull::Down));

    // Generate Alice identity
    println!("[ALICE] Generating identity keys...");
    let alice_id = AliceIdentity::generate(&mut rng);
    println!("[ALICE] Identity ready. Waiting for Bob's prekey bundle...");

    let mut reassembler = Reassembler::new(2000);
    let mut state = AppState::WaitingForBundle;
    let mut led_state = LedState::Idle;
    let mut led_toggle_tick: u32 = 0;
    let mut led_on = false;

    // Button debounce state: require 3 consecutive HIGH reads at 10ms apart
    let mut debounce_count: u8 = 0;
    let mut debounce_tick: u32 = 0;
    let mut button_was_pressed = false;

    let mut touch_blink_tick: u32 = 0;
    let mut touch_blinks_left: u32 = 0;

    let mode = HandshakeMode::Hybrid;

    loop {
        let tick = unsafe {
            TICK = TICK.wrapping_add(1);
            TICK
        };

        // --- LED pattern ---
        match led_state {
            LedState::Idle => {
                // Slow pulse: 1 Hz, ~20% duty
                let phase = tick % 1000;
                if phase < 200 {
                    if !led_on { led.set_high(); led_on = true; }
                } else {
                    if led_on { led.set_low(); led_on = false; }
                }
            }
            LedState::Handshaking => {
                // Fast pulse: 8 Hz, 50% duty
                let phase = tick % 125;
                if phase < 62 {
                    if !led_on { led.set_high(); led_on = true; }
                } else {
                    if led_on { led.set_low(); led_on = false; }
                }
            }
            LedState::Established => {
                if !led_on { led.set_high(); led_on = true; }
            }
            LedState::TouchFlash(_) => {
                // 3 rapid blinks at 20 Hz (~200ms total)
                if touch_blinks_left > 0 {
                    let phase = tick.wrapping_sub(touch_blink_tick) % 50;
                    if phase < 25 {
                        if !led_on { led.set_high(); led_on = true; }
                    } else {
                        if led_on {
                            led.set_low();
                            led_on = false;
                            touch_blinks_left -= 1;
                        }
                    }
                } else {
                    led_state = LedState::Established;
                }
            }
            LedState::Error => {
                // SOS pattern: ···–––···
                let phase = tick % 3000;
                let sos = matches!(phase,
                    0..=99 | 200..=299 | 400..=499 |     // ···
                    700..=1099 | 1300..=1699 | 1900..=2299 | // –––
                    2500..=2599 | 2700..=2799 | 2900..=2999   // ···
                );
                if sos { if !led_on { led.set_high(); led_on = true; } }
                else { if led_on { led.set_low(); led_on = false; } }
            }
        }

        // --- Button debounce ---
        let button_pressed = {
            let currently_high = button.is_high();
            if currently_high {
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
            if !currently_high {
                button_was_pressed = false;
            }
            pressed
        };

        // --- Receive ESP-NOW frames ---
        if let Some(received) = esp_now.receive() {
            if let Some(frame) = Frame::decode(received.data()) {
                match reassembler.feed(&frame, tick) {
                    ReassemblyResult::Complete(msg_type, data) => {
                        match DecodedMessage::from_reassembled(msg_type, &data) {
                            Ok(DecodedMessage::PrekeyBundle(bundle)) => {
                                if matches!(state, AppState::WaitingForBundle) {
                                    log_send(&mut esp_now, "Received Bob's prekey bundle");
                                    led_state = LedState::Handshaking;

                                    // Run PQXDH handshake
                                    log_send(&mut esp_now, "Running PQXDH handshake...");
                                    let payload = b"hello bob!";
                                    match alice_id.process_prekey_bundle(
                                        &bundle, mode, payload, &mut rng,
                                    ) {
                                        Ok((session, initial_msg)) => {
                                            // Send InitialMessage
                                            let encoded = initial_msg.encode();
                                            let frames = frame::fragment(
                                                wire::MSG_INITIAL_MESSAGE,
                                                next_msg_id(),
                                                &encoded,
                                            );
                                            log_send(&mut esp_now,
                                                &format_msg("Sending InitialMessage ({} fragments)", frames.len()));
                                            for f in frames.iter() {
                                                let raw = f.encode();
                                                let _ = esp_now.send(&BROADCAST_ADDRESS, &raw)
                                                    .map(|w| w.wait());
                                            }

                                            if mode == HandshakeMode::ClassicalOnly {
                                                log_send(&mut esp_now,
                                                    "Handshake complete (CLASSICAL ONLY)");
                                            } else {
                                                log_send(&mut esp_now,
                                                    "Handshake complete (HYBRID: X25519 + ML-KEM-768)");
                                            }

                                            state = AppState::HandshakeComplete(session);
                                            led_state = LedState::Established;
                                        }
                                        Err(e) => {
                                            log_send(&mut esp_now,
                                                &format_msg("Handshake FAILED: {:?}", e));
                                            led_state = LedState::Error;
                                        }
                                    }
                                }
                            }
                            Ok(DecodedMessage::SessionMessage(msg)) => {
                                if let AppState::HandshakeComplete(ref mut session) = state {
                                    match session.decrypt(&msg) {
                                        Ok(pt) => {
                                            let text = core::str::from_utf8(&pt).unwrap_or("<binary>");
                                            log_send(&mut esp_now,
                                                &format_msg("Received: {}", text));
                                        }
                                        Err(e) => {
                                            log_send(&mut esp_now,
                                                &format_msg("Decrypt failed: {:?}", e));
                                        }
                                    }
                                }
                            }
                            Ok(_) => {} // Ignore other message types
                            Err(_) => {}
                        }
                    }
                    ReassemblyResult::Incomplete => {}
                    ReassemblyResult::Dropped => {}
                }
            }
        }

        // --- Button press actions ---
        if button_pressed {
            match state {
                AppState::WaitingForBundle => {
                    log_send(&mut esp_now, "Button pressed but no bundle yet — waiting...");
                }
                AppState::HandshakeComplete(ref mut session) => {
                    led_state = LedState::TouchFlash(3);
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
                                let _ = esp_now.send(&BROADCAST_ADDRESS, &raw)
                                    .map(|w| w.wait());
                            }
                            log_send(&mut esp_now, "Sent encrypted ping");
                        }
                        Err(e) => {
                            log_send(&mut esp_now, &format_msg("Encrypt failed: {:?}", e));
                        }
                    }
                }
            }
        }

        // Tiny delay to avoid busy-looping too hard
        for _ in 0..1000 { core::hint::spin_loop(); }
    }
}

// Minimal formatting helper (no alloc)
fn format_msg(template: &str, _arg: impl core::fmt::Debug) -> heapless::String<200> {
    // For no_std without alloc, we use a simple approach
    let mut s = heapless::String::new();
    // We can't use format! without alloc, so we do a basic concat
    let _ = s.push_str(template);
    s
}

#[panic_handler]
fn panic(info: &core::panic::PanicInfo) -> ! {
    println!("[ALICE] PANIC: {}", info);
    loop {
        core::hint::spin_loop();
    }
}
