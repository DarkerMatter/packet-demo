#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_futures::select::{Either, select};
use embassy_time::{Duration, Ticker};
use esp_alloc as _;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    interrupt::software::SoftwareInterruptControl,
    timer::timg::TimerGroup,
};
use esp_println::println;
use esp_radio::esp_now::BROADCAST_ADDRESS;

esp_bootloader_esp_idf::esp_app_desc!();

#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let config = esp_hal::Config::default().with_cpu_clock(CpuClock::max());
    let peripherals = esp_hal::init(config);

    esp_alloc::heap_allocator!(size: 72 * 1024);

    let sw_ints = SoftwareInterruptControl::new(peripherals.SW_INTERRUPT);
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, sw_ints.software_interrupt0);

    let (_controller, interfaces) =
        esp_radio::wifi::new(peripherals.WIFI, Default::default()).unwrap();
    let mut esp_now = interfaces.esp_now;
    esp_now.set_channel(1).unwrap();

    let mac = interfaces.station.mac_address();
    println!("ESP-NOW TEST - BOB");
    println!("MAC: {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    println!("Version: {:?}", esp_now.version());
    println!("Broadcasting every 1 second...");

    let mut rx_count = 0u32;
    let mut tx_count = 0u32;
    let mut ticker = Ticker::every(Duration::from_secs(1));

    loop {
        let res = select(ticker.next(), async {
            let r = esp_now.receive_async().await;
            rx_count += 1;
            let data = r.data();
            let src = r.info.src_address;
            println!("RX #{} from {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x} len={} data={:02x?}",
                rx_count, src[0], src[1], src[2], src[3], src[4], src[5],
                data.len(), &data[..data.len().min(16)]);
        }).await;

        match res {
            Either::First(_) => {
                tx_count += 1;
                let status = esp_now.send_async(&BROADCAST_ADDRESS, b"BOB_PING").await;
                println!("TX #{}: {:?}", tx_count, status);
            }
            Either::Second(_) => {}
        }
    }
}
