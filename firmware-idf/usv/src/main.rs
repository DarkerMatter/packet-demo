use std::thread;
use std::time::Duration;

use esp_idf_svc::espnow::{EspNow, PeerInfo, BROADCAST};
use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::wifi::{EspWifi, WifiDriver};
use esp_idf_hal::peripherals::Peripherals;
use log::*;

fn main() {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    let peripherals = Peripherals::take().unwrap();
    let sysloop = EspSystemEventLoop::take().unwrap();
    let nvs = EspDefaultNvsPartition::take().unwrap();

    // Init WiFi driver (required for ESP-NOW)
    let wifi_driver = WifiDriver::new(peripherals.modem, sysloop.clone(), Some(nvs)).unwrap();

    // Init ESP-NOW
    let esp_now = EspNow::take().unwrap();

    // Add broadcast peer
    let peer = PeerInfo {
        peer_addr: BROADCAST,
        ..Default::default()
    };
    esp_now.add_peer(peer).unwrap();

    // Register receive callback
    esp_now
        .register_recv_cb(|src_addr, data| {
            info!(
                "RX from {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x} len={}: {:?}",
                src_addr[0], src_addr[1], src_addr[2], src_addr[3], src_addr[4], src_addr[5],
                data.len(),
                core::str::from_utf8(&data[..data.len().min(20)]).unwrap_or("<binary>")
            );
        })
        .unwrap();

    info!("ESP-NOW TEST - USV");
    info!("Sending broadcasts every 2 seconds...");

    let mut seq = 0u32;
    loop {
        seq += 1;
        let msg = format!("USV_PING_{:03}", seq);
        match esp_now.send(BROADCAST, msg.as_bytes()) {
            Ok(()) => info!("TX #{}: {}", seq, msg),
            Err(e) => error!("TX #{} error: {:?}", seq, e),
        }
        thread::sleep(Duration::from_secs(2));
    }
}
