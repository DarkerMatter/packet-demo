use std::net::UdpSocket;
use std::thread;
use std::time::Duration;

use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::wifi::{BlockingWifi, ClientConfiguration, Configuration, EspWifi};
use esp_idf_hal::peripherals::Peripherals;
use esp_idf_hal::gpio::{PinDriver, Pull};
use log::*;
use pqxdh_shared::pqxdh::*;
use pqxdh_shared::wire;

const WIFI_SSID: &str = "Aries";
const WIFI_PASS: &str = "YourMomL";
const GND_PORT: u16 = 4210;
const USV_PORT: u16 = 4211;
const BROADCAST: &str = "255.255.255.255";

const MSG_PREKEY: u8 = 0x01;
const MSG_INITIAL: u8 = 0x02;
const MSG_SESSION: u8 = 0x03;

fn main() {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    let peripherals = Peripherals::take().unwrap();
    let sysloop = EspSystemEventLoop::take().unwrap();
    let nvs = EspDefaultNvsPartition::take().unwrap();

    // Touch sensor on GPIO10
    let mut button = PinDriver::input(peripherals.pins.gpio10).unwrap();
    button.set_pull(Pull::Down).unwrap();

    let mut wifi = BlockingWifi::wrap(
        EspWifi::new(peripherals.modem, sysloop.clone(), Some(nvs)).unwrap(),
        sysloop,
    ).unwrap();

    wifi.set_configuration(&Configuration::Client(ClientConfiguration {
        ssid: WIFI_SSID.try_into().unwrap(),
        password: WIFI_PASS.try_into().unwrap(),
        ..Default::default()
    })).unwrap();

    wifi.start().unwrap();
    println!("[USV] WiFi started, connecting to {}...", WIFI_SSID);
    loop {
        match wifi.connect() {
            Ok(()) => match wifi.wait_netif_up() {
                Ok(()) => break,
                Err(e) => { println!("[USV] Netif error: {:?}", e); thread::sleep(Duration::from_secs(2)); }
            },
            Err(e) => { println!("[USV] Connect failed: {:?}, retrying...", e); thread::sleep(Duration::from_secs(2)); }
        }
    }

    let ip_info = wifi.wifi().sta_netif().get_ip_info().unwrap();
    println!("[USV] Connected! IP: {}", ip_info.ip);

    // Generate USV identity (Alice role)
    println!("[USV] Generating identity keys...");
    let mut rng = rand::thread_rng();
    let usv_id = AliceIdentity::generate(&mut rng);
    println!("[USV] Identity ready");

    // UDP socket
    let sock = UdpSocket::bind(format!("0.0.0.0:{}", USV_PORT)).unwrap();
    sock.set_broadcast(true).unwrap();
    sock.set_read_timeout(Some(Duration::from_millis(100))).unwrap();
    println!("[USV] UDP on port {}", USV_PORT);

    // Discover Ground Station and get prekey bundle
    println!("[USV] Discovering Ground Station...");
    let mut gnd_addr = None;
    let mut session: Option<AliceSession> = None;

    loop {
        // Send discovery broadcast
        let _ = sock.send_to(b"USV_DISCOVER", format!("{}:{}", BROADCAST, GND_PORT));

        let mut buf = [0u8; 2048];
        match sock.recv_from(&mut buf) {
            Ok((len, src)) => {
                let data = &buf[..len];
                if len < 1 { continue; }

                if data[0] == MSG_PREKEY {
                    let payload = &data[1..];
                    println!("[USV] Received prekey bundle ({} bytes) from {}", payload.len(), src);
                    gnd_addr = Some(src);

                    match PrekeyBundle::decode(payload) {
                        Ok(bundle) => {
                            println!("[USV] Running PQXDH handshake (HYBRID: X25519 + ML-KEM-768)...");
                            let mode = HandshakeMode::Hybrid;
                            match usv_id.process_prekey_bundle(&bundle, mode, b"hello ground station!", &mut rng) {
                                Ok((sess, initial_msg)) => {
                                    // Send InitialMessage
                                    let wire = initial_msg.encode();
                                    let mut msg = Vec::with_capacity(1 + wire.len());
                                    msg.push(MSG_INITIAL);
                                    msg.extend_from_slice(&wire);
                                    let _ = sock.send_to(&msg, src);
                                    println!("[USV] Sent InitialMessage ({} bytes)", msg.len());
                                    println!("[USV] Handshake complete! Session established.");
                                    session = Some(sess);
                                    break;
                                }
                                Err(e) => println!("[USV] Handshake FAILED: {:?}", e),
                            }
                        }
                        Err(e) => println!("[USV] Bundle decode error: {:?}", e),
                    }
                }
            }
            Err(_) => {} // timeout
        }
        thread::sleep(Duration::from_millis(500));
    }

    println!("[USV] Ready! Touch sensor to send encrypted ping.");

    let gnd_addr = gnd_addr.unwrap();
    let mut sess = session.unwrap();
    let mut button_was_pressed = false;
    let mut auto_seq = 0u32;

    loop {
        // Check for incoming encrypted messages
        let mut buf = [0u8; 2048];
        match sock.recv_from(&mut buf) {
            Ok((len, _src)) => {
                let data = &buf[..len];
                if len > 1 && data[0] == MSG_SESSION {
                    match SessionMessage::decode(&data[1..]) {
                        Ok(msg) => match sess.decrypt(&msg) {
                            Ok(pt) => {
                                let text = std::str::from_utf8(&pt).unwrap_or("<bin>");
                                println!("[USV] Received encrypted: \"{}\"", text);
                            }
                            Err(e) => println!("[USV] Decrypt error: {:?}", e),
                        },
                        Err(e) => println!("[USV] Decode error: {:?}", e),
                    }
                }
            }
            Err(_) => {}
        }

        // Button (touch sensor) check
        let pressed = button.is_high();
        if pressed && !button_was_pressed {
            match sess.encrypt(b"ping") {
                Ok(msg) => {
                    let wire = msg.encode();
                    let mut pkt = Vec::with_capacity(1 + wire.len());
                    pkt.push(MSG_SESSION);
                    pkt.extend_from_slice(&wire);

                    // Print raw encrypted bytes for demo
                    println!("[USV] Sending encrypted ping ({} bytes)", pkt.len());
                    println!("[USV] Raw ciphertext: {:02x?}", &pkt[..pkt.len().min(48)]);

                    let _ = sock.send_to(&pkt, gnd_addr);
                }
                Err(e) => println!("[USV] Encrypt error: {:?}", e),
            }
        }
        button_was_pressed = pressed;

        // Also send a ping every 10 seconds automatically for demo
        auto_seq += 1;
        if auto_seq % 100 == 0 {
            let msg_text = format!("auto-ping-{}", auto_seq / 100);
            match sess.encrypt(msg_text.as_bytes()) {
                Ok(msg) => {
                    let wire = msg.encode();
                    let mut pkt = Vec::with_capacity(1 + wire.len());
                    pkt.push(MSG_SESSION);
                    pkt.extend_from_slice(&wire);
                    println!("[USV] Auto-ping: \"{}\" -> {} encrypted bytes", msg_text, pkt.len());
                    let _ = sock.send_to(&pkt, gnd_addr);
                }
                Err(e) => println!("[USV] Encrypt error: {:?}", e),
            }
        }

        thread::sleep(Duration::from_millis(100));
    }
}
