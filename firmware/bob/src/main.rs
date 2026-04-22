#![no_std]
#![no_main]

use esp_hal::{
    clock::CpuClock,
    gpio::{Level, Output, OutputConfig},
    rng::Rng,
    timer::timg::TimerGroup,
};
use esp_println::println;
use esp_wifi::esp_now::{EspNow, BROADCAST_ADDRESS};
use pqxdh_shared::{
    frame::{self, Frame, Reassembler, ReassemblyResult, DecodedMessage},
    pqxdh::{BobIdentity, BobSession, HandshakeMode},
    wire,
};

// LED: GPIO2 (D0) — change if your board's LED is on a different pin
const PREKEY_BROADCAST_INTERVAL: u32 = 3000; // broadcast every ~3 seconds

#[derive(Clone, Copy, PartialEq)]
enum LedState {
    Idle,
    Handshaking,
    Established,
    TouchFlash,
    Error,
}

enum AppState {
    WaitingForAlice,
    SessionEstablished(BobSession),
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
    println!("[BOB] MAC: {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    // LED on GPIO2
    let mut led = Output::new(peripherals.GPIO2, Level::Low, OutputConfig::default());

    // Generate Bob identity
    println!("[BOB] Generating identity keys (X25519 + Ed25519 + ML-KEM-768)...");
    let mut bob_id = BobIdentity::generate(&mut rng);
    println!("[BOB] Identity ready. Broadcasting prekey bundle...");

    let bundle = bob_id.prekey_bundle();
    let bundle_encoded = bundle.encode();

    let mut reassembler = Reassembler::new(2000);
    let mut state = AppState::WaitingForAlice;
    let mut led_state = LedState::Idle;
    let mut led_on = false;
    let mut tick: u32 = 0;
    let mut last_broadcast_tick: u32 = 0;
    let mut touch_blinks_left: u32 = 0;
    let mut touch_blink_tick: u32 = 0;

    loop {
        tick = tick.wrapping_add(1);

        // --- LED pattern ---
        match led_state {
            LedState::Idle => {
                let phase = tick % 1000;
                if phase < 200 {
                    if !led_on { led.set_high(); led_on = true; }
                } else {
                    if led_on { led.set_low(); led_on = false; }
                }
            }
            LedState::Handshaking => {
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
            LedState::TouchFlash => {
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
                let phase = tick % 3000;
                let sos = matches!(phase,
                    0..=99 | 200..=299 | 400..=499 |
                    700..=1099 | 1300..=1699 | 1900..=2299 |
                    2500..=2599 | 2700..=2799 | 2900..=2999
                );
                if sos { if !led_on { led.set_high(); led_on = true; } }
                else { if led_on { led.set_low(); led_on = false; } }
            }
        }

        // --- Periodically broadcast prekey bundle (before handshake) ---
        if matches!(state, AppState::WaitingForAlice)
            && tick.wrapping_sub(last_broadcast_tick) >= PREKEY_BROADCAST_INTERVAL
        {
            let frames = frame::fragment(wire::MSG_PREKEY_BUNDLE, next_msg_id(), &bundle_encoded);
            for f in frames.iter() {
                let raw = f.encode();
                let _ = esp_now.send(&BROADCAST_ADDRESS, &raw).map(|w| w.wait());
            }
            last_broadcast_tick = tick;
        }

        // --- Receive ESP-NOW frames ---
        if let Some(received) = esp_now.receive() {
            if let Some(frame) = Frame::decode(received.data()) {
                match reassembler.feed(&frame, tick) {
                    ReassemblyResult::Complete(msg_type, data) => {
                        match DecodedMessage::from_reassembled(msg_type, &data) {
                            Ok(DecodedMessage::InitialMessage(msg)) => {
                                if matches!(state, AppState::WaitingForAlice) {
                                    println!("[BOB] Received InitialMessage from Alice");
                                    led_state = LedState::Handshaking;

                                    println!("[BOB] Processing PQXDH handshake...");
                                    match bob_id.process_initial_message(&msg) {
                                        Ok((session, plaintext)) => {
                                            let text = core::str::from_utf8(&plaintext)
                                                .unwrap_or("<binary>");
                                            println!("[BOB] Handshake complete! Initial payload: {}", text);

                                            if msg.mode == HandshakeMode::ClassicalOnly {
                                                println!("[BOB] Mode: CLASSICAL ONLY (X25519)");
                                                println!("[EVE] Recorded handshake. Will decrypt in 2034 \u{1f60f}");
                                            } else {
                                                println!("[BOB] Mode: HYBRID (X25519 + ML-KEM-768)");
                                                println!("[EVE] Recorded handshake. Cannot decrypt \u{2620}\u{fe0f} (quantum-resistant)");
                                            }

                                            state = AppState::SessionEstablished(session);
                                            led_state = LedState::Established;
                                        }
                                        Err(e) => {
                                            println!("[BOB] Handshake FAILED: {:?}", e);
                                            led_state = LedState::Error;
                                        }
                                    }
                                }
                            }
                            Ok(DecodedMessage::SessionMessage(msg)) => {
                                if let AppState::SessionEstablished(ref mut session) = state {
                                    match session.decrypt(&msg) {
                                        Ok(pt) => {
                                            let text = core::str::from_utf8(&pt)
                                                .unwrap_or("<binary>");
                                            println!("[BOB] Received: {}", text);

                                            // Flash LED
                                            led_state = LedState::TouchFlash;
                                            touch_blinks_left = 3;
                                            touch_blink_tick = tick;

                                            // Send pong
                                            match session.encrypt(b"pong") {
                                                Ok(pong) => {
                                                    let encoded = pong.encode();
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
                                                    println!("[BOB] Sent encrypted pong");
                                                }
                                                Err(e) => {
                                                    println!("[BOB] Encrypt pong failed: {:?}", e);
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            println!("[BOB] Decrypt failed: {:?}", e);
                                        }
                                    }
                                }
                            }
                            Ok(DecodedMessage::LogRelay(relay)) => {
                                // Print Alice's relayed logs
                                let text = core::str::from_utf8(&relay.message)
                                    .unwrap_or("<invalid utf8>");
                                println!("[ALICE] {}", text);
                            }
                            Ok(_) => {} // Ignore own prekey broadcasts etc.
                            Err(_) => {}
                        }
                    }
                    ReassemblyResult::Incomplete => {}
                    ReassemblyResult::Dropped => {}
                }
            }
        }

        // Tiny delay
        for _ in 0..1000 { core::hint::spin_loop(); }
    }
}

#[panic_handler]
fn panic(info: &core::panic::PanicInfo) -> ! {
    println!("[BOB] PANIC: {}", info);
    loop {
        core::hint::spin_loop();
    }
}
