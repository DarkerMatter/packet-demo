use std::thread;
use std::time::Duration;

use esp_idf_svc::espnow::{EspNow, PeerInfo, BROADCAST};
use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::wifi::{EspWifi, AccessPointConfiguration, ClientConfiguration, Configuration};
use esp_idf_hal::peripherals::Peripherals;
use log::*;

fn main() {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    let peripherals = Peripherals::take().unwrap();
    let sysloop = EspSystemEventLoop::take().unwrap();
    let nvs = EspDefaultNvsPartition::take().unwrap();

    let mut wifi = EspWifi::new(peripherals.modem, sysloop, Some(nvs)).unwrap();
    wifi.set_configuration(&Configuration::Mixed(
        ClientConfiguration::default(),
        AccessPointConfiguration {
            ssid: "GND-ESPNOW".try_into().unwrap(),
            channel: 1,
            ..Default::default()
        },
    )).unwrap();
    wifi.start().unwrap();

    let mut primary: u8 = 0;
    let mut secondary: u32 = 0;
    unsafe {
        esp_idf_svc::sys::esp_wifi_get_channel(&mut primary, &mut secondary as *mut u32 as *mut _);
    }
    info!("WiFi AP mode, channel {} (secondary {})", primary, secondary);

    let esp_now = EspNow::take().unwrap();
    info!("ESP-NOW version: {:?}", esp_now.get_version());

    esp_now.add_peer(PeerInfo {
        peer_addr: BROADCAST,
        ..Default::default()
    }).unwrap();

    esp_now.register_send_cb(|_mac, status| {
        info!("send_cb: {:?}", status);
    }).unwrap();

    esp_now.register_recv_cb(|info, data| {
        let s = info.src_addr;
        info!(
            ">>> RX from {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x} len={}: {:?}",
            s[0], s[1], s[2], s[3], s[4], s[5],
            data.len(),
            core::str::from_utf8(&data[..data.len().min(30)]).unwrap_or("<bin>")
        );
    }).unwrap();

    info!("ESP-NOW TEST - GROUND STATION ready (AP mode, ch1)");

    let mut seq = 0u32;
    loop {
        seq += 1;
        let msg = format!("GND_{:03}", seq);
        match esp_now.send(BROADCAST, msg.as_bytes()) {
            Ok(()) => info!("TX #{}", seq),
            Err(e) => error!("TX err: {:?}", e),
        }
        thread::sleep(Duration::from_secs(1));
    }
}
