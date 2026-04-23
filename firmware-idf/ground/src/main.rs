use std::net::UdpSocket;
use std::thread;
use std::time::Duration;

use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::wifi::{BlockingWifi, ClientConfiguration, Configuration, EspWifi};
use esp_idf_hal::peripherals::Peripherals;
use log::*;
use pqxdh_shared::pqxdh::*;
use pqxdh_shared::wire;

const WIFI_SSID: &str = "Aries";
const WIFI_PASS: &str = "YourMomL";
const GND_PORT: u16 = 4210;

// Message type prefixes for UDP framing
const MSG_PREKEY: u8 = 0x01;
const MSG_INITIAL: u8 = 0x02;
const MSG_SESSION: u8 = 0x03;

fn main() {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    let peripherals = Peripherals::take().unwrap();
    let sysloop = EspSystemEventLoop::take().unwrap();
    let nvs = EspDefaultNvsPartition::take().unwrap();

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
    println!("[GND] WiFi started, connecting to {}...", WIFI_SSID);
    loop {
        match wifi.connect() {
            Ok(()) => match wifi.wait_netif_up() {
                Ok(()) => break,
                Err(e) => { println!("[GND] Netif error: {:?}", e); thread::sleep(Duration::from_secs(2)); }
            },
            Err(e) => { println!("[GND] Connect failed: {:?}, retrying...", e); thread::sleep(Duration::from_secs(2)); }
        }
    }

    let ip_info = wifi.wifi().sta_netif().get_ip_info().unwrap();
    println!("[GND] Connected! IP: {}", ip_info.ip);

    // Generate Ground Station identity (Bob role)
    println!("[GND] Generating identity keys (X25519 + Ed25519 + ML-KEM-768)...");
    let mut rng = rand::thread_rng();
    let mut gnd_id = BobIdentity::generate(&mut rng);
    println!("[GND] Identity ready");

    // Build and serialize prekey bundle
    let bundle = gnd_id.prekey_bundle();
    let bundle_wire = bundle.encode();
    println!("[GND] Prekey bundle ready ({} bytes)", bundle_wire.len());

    // UDP socket
    let sock = UdpSocket::bind(format!("0.0.0.0:{}", GND_PORT)).unwrap();
    sock.set_broadcast(true).unwrap();
    sock.set_read_timeout(Some(Duration::from_millis(100))).unwrap();
    println!("[GND] UDP listening on port {}", GND_PORT);
    println!("[GND] Waiting for USV discovery...");

    let mut usv_addr = None;
    let mut session: Option<BobSession> = None;

    loop {
        let mut buf = [0u8; 2048];
        match sock.recv_from(&mut buf) {
            Ok((len, src)) => {
                let data = &buf[..len];

                // Check for text-based discovery
                if let Ok(text) = std::str::from_utf8(data) {
                    if text.starts_with("USV_DISCOVER") {
                        println!("[GND] USV discovered at {}", src);
                        usv_addr = Some(src);

                        // Send prekey bundle with type prefix
                        let mut msg = Vec::with_capacity(1 + bundle_wire.len());
                        msg.push(MSG_PREKEY);
                        msg.extend_from_slice(&bundle_wire);
                        let _ = sock.send_to(&msg, src);
                        println!("[GND] Sent prekey bundle ({} bytes) to USV", msg.len());
                        continue;
                    }
                }

                // Binary protocol messages
                if len < 1 { continue; }
                let msg_type = data[0];
                let payload = &data[1..];

                match msg_type {
                    MSG_INITIAL => {
                        println!("[GND] Received InitialMessage ({} bytes)", payload.len());
                        match InitialMessage::decode(payload) {
                            Ok(initial_msg) => {
                                println!("[GND] Processing PQXDH handshake...");
                                match gnd_id.process_initial_message(&initial_msg) {
                                    Ok((sess, plaintext)) => {
                                        let text = std::str::from_utf8(&plaintext).unwrap_or("<bin>");
                                        println!("[GND] Handshake complete! Payload: \"{}\"", text);

                                        if initial_msg.mode == HandshakeMode::ClassicalOnly {
                                            println!("[GND] Mode: CLASSICAL ONLY (X25519)");
                                            println!("[EVE] Recorded handshake. Will decrypt in 2034.");
                                        } else {
                                            println!("[GND] Mode: HYBRID (X25519 + ML-KEM-768)");
                                            println!("[EVE] Cannot decrypt. Quantum-resistant key exchange.");
                                        }

                                        session = Some(sess);
                                    }
                                    Err(e) => println!("[GND] Handshake FAILED: {:?}", e),
                                }
                            }
                            Err(e) => println!("[GND] Decode error: {:?}", e),
                        }
                    }
                    MSG_SESSION => {
                        if let Some(ref mut sess) = session {
                            match SessionMessage::decode(payload) {
                                Ok(msg) => {
                                    match sess.decrypt(&msg) {
                                        Ok(pt) => {
                                            let text = std::str::from_utf8(&pt).unwrap_or("<bin>");
                                            println!("[GND] Received encrypted: \"{}\"", text);

                                            // Send encrypted pong back
                                            if let Some(addr) = usv_addr {
                                                match sess.encrypt(b"pong") {
                                                    Ok(pong) => {
                                                        let pong_wire = pong.encode();
                                                        let mut reply = Vec::with_capacity(1 + pong_wire.len());
                                                        reply.push(MSG_SESSION);
                                                        reply.extend_from_slice(&pong_wire);
                                                        let _ = sock.send_to(&reply, addr);
                                                        println!("[GND] Sent encrypted pong");
                                                    }
                                                    Err(e) => println!("[GND] Encrypt error: {:?}", e),
                                                }
                                            }
                                        }
                                        Err(e) => println!("[GND] Decrypt failed: {:?}", e),
                                    }
                                }
                                Err(e) => println!("[GND] Decode error: {:?}", e),
                            }
                        }
                    }
                    _ => {
                        // Unknown message, show raw hex (for demo - shows encrypted data)
                        println!("[GND] Unknown msg type 0x{:02x}, {} bytes: {:02x?}",
                            msg_type, payload.len(), &payload[..payload.len().min(32)]);
                    }
                }
            }
            Err(_) => {} // timeout
        }
    }
}
