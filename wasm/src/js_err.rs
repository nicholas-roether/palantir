use std::error::Error;

pub trait ToJsError: Error + Into<js_sys::Error> {}
