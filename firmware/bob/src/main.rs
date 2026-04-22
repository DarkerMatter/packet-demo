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
    println!("ESP-NOW TEST - SENDER");
    println!("MAC: {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    println!("Version: {:?}", esp_now.version());
    println!("Peer count: {:?}", esp_now.peer_count());
    println!("Broadcasting every ~1 second...");

    let delay = Delay::new();
    let mut seq = 0u32;
    let mut rx_count = 0u32;
    let mut loop_count = 0u32;
    loop {
        loop_count += 1;

        // Check for received frames
        if let Some(received) = esp_now.receive() {
            rx_count += 1;
            let data = received.data();
            let src = received.info.src_address;
            println!("RX #{} from {:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x} len={} data={:02x?}",
                rx_count,
                src[0], src[1], src[2], src[3], src[4], src[5],
                data.len(),
                &data[..data.len().min(16)]);
        }

        // Send broadcast every ~1 second (100 loops * 10ms)
        if loop_count % 100 == 0 {
            seq += 1;
            let mut msg = [0u8; 16];
            msg[..9].copy_from_slice(b"BOB_PING_");
            let s = seq % 1000;
            msg[9] = b'0' + (s / 100) as u8;
            msg[10] = b'0' + ((s / 10) % 10) as u8;
            msg[11] = b'0' + (s % 10) as u8;

            match esp_now.send(&BROADCAST_ADDRESS, &msg[..12]) {
                Ok(waiter) => match waiter.wait() {
                    Ok(()) => println!("TX #{}: BOB_PING_{:03}", seq, s),
                    Err(e) => println!("TX #{} wait err: {:?}", seq, e),
                },
                Err(e) => println!("TX #{} err: {:?}", seq, e),
            }
        }

        // 10ms delay — gives RTOS scheduler time to process WiFi events
        delay.delay_millis(10);
    }
}
