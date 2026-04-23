use std::net::UdpSocket;
use std::thread;
use std::time::Duration;

use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::wifi::{BlockingWifi, ClientConfiguration, Configuration, EspWifi};
use esp_idf_hal::peripherals::Peripherals;
use log::*;

const WIFI_SSID: &str = "Aries";
const WIFI_PASS: &str = "YourMomL";
const GND_PORT: u16 = 4210;

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
    info!("[GND] WiFi started, connecting to {}...", WIFI_SSID);
    loop {
        match wifi.connect() {
            Ok(()) => {
                info!("[GND] WiFi associated, waiting for IP...");
                match wifi.wait_netif_up() {
                    Ok(()) => break,
                    Err(e) => error!("[GND] Netif error: {:?}, retrying...", e),
                }
            }
            Err(e) => {
                error!("[GND] Connect failed: {:?}, retrying in 2s...", e);
                thread::sleep(Duration::from_secs(2));
            }
        }
    }

    let ip_info = wifi.wifi().sta_netif().get_ip_info().unwrap();
    info!("[GND] Connected! IP: {}", ip_info.ip);

    let sock = UdpSocket::bind(format!("0.0.0.0:{}", GND_PORT)).unwrap();
    sock.set_broadcast(true).unwrap();
    sock.set_read_timeout(Some(Duration::from_millis(100))).unwrap();
    info!("[GND] UDP listening on port {}", GND_PORT);
    info!("[GND] Waiting for USV...");

    let mut usv_addr = None;
    let mut seq = 0u32;

    loop {
        let mut buf = [0u8; 1500];
        match sock.recv_from(&mut buf) {
            Ok((len, src)) => {
                let data = &buf[..len];
                if let Ok(text) = std::str::from_utf8(data) {
                    if text.starts_with("USV_DISCOVER") {
                        info!("[GND] USV discovered at {}", src);
                        usv_addr = Some(src);
                        let _ = sock.send_to(b"GND_ACK", src);
                        info!("[GND] Sent ACK");
                    } else {
                        info!("[GND] RX from {}: {}", src, text);
                        if let Some(addr) = usv_addr {
                            seq += 1;
                            let pong = format!("PONG_{:04}", seq);
                            let _ = sock.send_to(pong.as_bytes(), addr);
                            info!("[GND] TX: {}", pong);
                        }
                    }
                }
            }
            Err(_) => {}
        }
    }
}
