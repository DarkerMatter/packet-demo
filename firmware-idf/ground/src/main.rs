use std::thread;
use std::time::Duration;

fn main() {
    esp_idf_svc::sys::link_patches();
    println!("[GND] Ready");
    loop {
        thread::sleep(Duration::from_secs(60));
    }
}
