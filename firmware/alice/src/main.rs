#![no_std]
#![no_main]

use esp_hal::{
    clock::CpuClock,
    delay::Delay,
    interrupt::software::SoftwareInterruptControl,
    rng::Rng,
    timer::timg::TimerGroup,
};
use esp_backtrace as _;
esp_bootloader_esp_idf::esp_app_desc!();
use esp_println::println;
use esp_radio::esp_now::BROADCAST_ADDRESS;

#[esp_hal::main]
fn main() -> ! {
    let config = esp_hal::Config::default().with_cpu_clock(CpuClock::max());
    let peripherals = esp_hal::init(config);

    esp_alloc::heap_allocator!(size: 72 * 1024);

    let timg0 = TimerGroup::new(peripherals.TIMG0);
    let sw_ints = SoftwareInterruptControl::new(peripherals.SW_INTERRUPT);
    esp_rtos::start(timg0.timer0, sw_ints.software_interrupt0);

    let radio_ctrl = esp_radio::init().expect("Radio init failed");
    let (_wifi_ctrl, interfaces) =
        esp_radio::wifi::new(&radio_ctrl, peripherals.WIFI, Default::default())
            .expect("WiFi new failed");
    let mut esp_now = interfaces.esp_now;

    let mac = esp_radio::wifi::sta_mac();
    println!("ESP-NOW TEST - RECEIVER");
    println!("MAC: {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    println!("Version: {:?}", esp_now.version());
    println!("Peer count: {:?}", esp_now.peer_count());
    println!("Waiting for frames...");

    let delay = Delay::new();
    let mut count = 0u32;
    let mut seq = 0u32;
    loop {
        // Poll for received frames
        if let Some(received) = esp_now.receive() {
            count += 1;
            let data = received.data();
            let src = received.info.src_address;
            println!("RX #{} from {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x} len={} data={:02x?}",
                count,
                src[0], src[1], src[2], src[3], src[4], src[5],
                data.len(),
                &data[..data.len().min(16)]);
        }

        // Send a ping every 2 seconds
        seq += 1;
        if seq % 200 == 0 {
            let msg = b"ALICE_PING";
            match esp_now.send(&BROADCAST_ADDRESS, msg) {
                Ok(waiter) => match waiter.wait() {
                    Ok(()) => println!("TX ok: ALICE_PING #{}", seq / 200),
                    Err(e) => println!("TX wait err: {:?}", e),
                },
                Err(e) => println!("TX err: {:?}", e),
            }
        }

        if seq % 500 == 0 {
            println!("heartbeat rx_count={}", count);
        }

        // 10ms delay — gives RTOS scheduler time to process WiFi events
        delay.delay_millis(10);
    }
}
