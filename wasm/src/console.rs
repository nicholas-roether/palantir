use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
	#[wasm_bindgen(js_namespace = console)]
	pub fn log(s: &str);

	#[wasm_bindgen(js_namespace = console)]
	pub fn warn(s: &str);
}

#[macro_export]
macro_rules! console_log {
	($($t:tt)*) => ($crate::console::log(&format_args!($($t)*).to_string()))
}

#[macro_export]
macro_rules! console_warn {
	($($t:tt)*) => ($crate::console::warn(&format_args!($($t)*).to_string()))
}
