use std::thread;
use std::time::Duration;

use esp_idf_hal::gpio::{PinDriver, Pull};
use esp_idf_hal::peripherals::Peripherals;

fn main() {
    esp_idf_svc::sys::link_patches();

    let peripherals = Peripherals::take().unwrap();
    let button = PinDriver::input(peripherals.pins.gpio9, Pull::Down).unwrap();

    println!("[USV] Ready");
    println!("[USV] GPIO10 initial state: {}", if button.is_high() { "HIGH" } else { "LOW" });

    let mut was_pressed = false;
    let mut tick = 0u32;
    loop {
        let pressed = button.is_high();

        // Print state every 2 seconds for debugging
        tick += 1;
        if tick % 40 == 0 {
            println!("[USV] GPIO10={} tick={}", if pressed { "HIGH" } else { "LOW" }, tick);
        }

        if pressed && !was_pressed {
            println!("[USV] BUTTON");
        }
        was_pressed = pressed;
        thread::sleep(Duration::from_millis(50));
    }
}
