use std::thread;
use std::time::Duration;

use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::wifi::{BlockingWifi, ClientConfiguration, Configuration, EspWifi};
use esp_idf_hal::peripherals::Peripherals;
use log::*;

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

    wifi.set_configuration(&Configuration::Client(ClientConfiguration::default())).unwrap();
    wifi.start().unwrap();

    info!("=== WiFi Scanner ===");
    loop {
        info!("Scanning...");
        match wifi.scan() {
            Ok(networks) => {
                info!("Found {} networks:", networks.len());
                for ap in &networks {
                    info!("  SSID: {:?}  RSSI: {}  Channel: {}  Auth: {:?}",
                        ap.ssid, ap.signal_strength, ap.channel, ap.auth_method);
                }
            }
            Err(e) => error!("Scan error: {:?}", e),
        }
        thread::sleep(Duration::from_secs(5));
    }
}
