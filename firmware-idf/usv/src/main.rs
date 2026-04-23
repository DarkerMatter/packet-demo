use std::thread;
use std::time::Duration;

use esp_idf_hal::gpio::{PinDriver, Pull};
use esp_idf_hal::peripherals::Peripherals;

fn main() {
    esp_idf_svc::sys::link_patches();

    let peripherals = Peripherals::take().unwrap();
    let button = PinDriver::input(peripherals.pins.gpio10, Pull::Down).unwrap();

    println!("[USV] Ready");

    let mut was_pressed = false;
    loop {
        let pressed = button.is_high();
        if pressed && !was_pressed {
            println!("[USV] BUTTON");
        }
        was_pressed = pressed;
        thread::sleep(Duration::from_millis(50));
    }
}
