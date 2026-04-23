use std::net::UdpSocket;
use std::thread;
use std::time::Duration;

use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::wifi::{AuthMethod, BlockingWifi, ClientConfiguration, Configuration, EspWifi};
use esp_idf_hal::peripherals::Peripherals;
use log::*;

const WIFI_SSID: &str = "Aries";
const WIFI_PASS: &str = "YourMomL";
const GND_PORT: u16 = 4210;
const USV_PORT: u16 = 4211;
const BROADCAST: &str = "255.255.255.255";

fn main() {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    let peripherals = Peripherals::take().unwrap();
    let sysloop = EspSystemEventLoop::take().unwrap();
    let nvs = EspDefaultNvsPartition::take().unwrap();

    // Connect to WiFi
    let mut wifi = BlockingWifi::wrap(
        EspWifi::new(peripherals.modem, sysloop.clone(), Some(nvs)).unwrap(),
        sysloop,
    ).unwrap();

    wifi.set_configuration(&Configuration::Client(ClientConfiguration {
        ssid: WIFI_SSID.try_into().unwrap(),
        password: WIFI_PASS.try_into().unwrap(),
        auth_method: AuthMethod::WPA2Personal,
        ..Default::default()
    })).unwrap();

    wifi.start().unwrap();
    info!("[USV] WiFi started, connecting to {}...", WIFI_SSID);
    loop {
        match wifi.connect() {
            Ok(()) => {
                info!("[USV] WiFi associated, waiting for IP...");
                match wifi.wait_netif_up() {
                    Ok(()) => break,
                    Err(e) => error!("[USV] Netif error: {:?}, retrying...", e),
                }
            }
            Err(e) => {
                error!("[USV] Connect failed: {:?}, retrying in 2s...", e);
                thread::sleep(Duration::from_secs(2));
            }
        }
    }

    let ip_info = wifi.wifi().sta_netif().get_ip_info().unwrap();
    info!("[USV] Connected! IP: {}", ip_info.ip);

    // UDP socket
    let sock = UdpSocket::bind(format!("0.0.0.0:{}", USV_PORT)).unwrap();
    sock.set_broadcast(true).unwrap();
    sock.set_read_timeout(Some(Duration::from_millis(100))).unwrap();
    info!("[USV] UDP listening on port {}", USV_PORT);

    // Broadcast discovery to find Ground Station
    info!("[USV] Broadcasting discovery...");
    let mut gnd_addr = None;
    for _ in 0..30 {
        let msg = format!("USV_DISCOVER:{}", ip_info.ip);
        let _ = sock.send_to(msg.as_bytes(), format!("{}:{}", BROADCAST, GND_PORT));

        let mut buf = [0u8; 256];
        if let Ok((len, src)) = sock.recv_from(&mut buf) {
            let data = &buf[..len];
            if let Ok(text) = std::str::from_utf8(data) {
                if text.starts_with("GND_ACK") {
                    gnd_addr = Some(src);
                    info!("[USV] Found Ground Station at {}", src);
                    break;
                }
            }
        }
        thread::sleep(Duration::from_millis(500));
    }

    let gnd_addr = match gnd_addr {
        Some(addr) => addr,
        None => {
            error!("[USV] Could not find Ground Station! Retrying forever...");
            loop {
                let msg = format!("USV_DISCOVER:{}", ip_info.ip);
                let _ = sock.send_to(msg.as_bytes(), format!("{}:{}", BROADCAST, GND_PORT));
                let mut buf = [0u8; 256];
                if let Ok((len, src)) = sock.recv_from(&mut buf) {
                    if std::str::from_utf8(&buf[..len]).map(|t| t.starts_with("GND_ACK")).unwrap_or(false) {
                        info!("[USV] Found Ground Station at {}", src);
                        break src;
                    }
                }
                thread::sleep(Duration::from_millis(1000));
            }
        }
    };

    // Main loop: send pings, receive pongs
    info!("[USV] Ready! Sending pings to {}", gnd_addr);
    let mut seq = 0u32;
    loop {
        seq += 1;
        let msg = format!("PING_{:04}", seq);
        match sock.send_to(msg.as_bytes(), gnd_addr) {
            Ok(_) => info!("[USV] TX: {}", msg),
            Err(e) => error!("[USV] TX error: {:?}", e),
        }

        // Check for responses
        let mut buf = [0u8; 256];
        if let Ok((len, src)) = sock.recv_from(&mut buf) {
            let data = std::str::from_utf8(&buf[..len]).unwrap_or("<bin>");
            info!("[USV] RX from {}: {}", src, data);
        }

        thread::sleep(Duration::from_secs(2));
    }
}
