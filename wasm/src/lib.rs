use wasm_bindgen::prelude::*;

mod eye_renderer;

mod js_err;

mod console;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen(start)]
pub fn init() {
	std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}
