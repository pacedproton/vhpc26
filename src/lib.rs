#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

slint::include_modules!();

#[cfg(target_arch = "wasm32")]
mod web {
    use wasm_bindgen::prelude::*;
    #[wasm_bindgen(inline_js = "export function open_url(url) { window.open(url, '_blank'); }")]
    extern "C" {
        pub fn open_url(url: &str);
    }
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen(start))]
pub fn main() {
    let window = MainWindow::new().unwrap();

    #[cfg(target_arch = "wasm32")]
    window.global::<AppLinks>().on_open_url(|url| {
        web::open_url(url.as_str());
    });

    window.run().unwrap();
}
