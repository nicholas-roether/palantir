use quote::quote;
use syn::{parse_macro_input, DeriveInput};

#[proc_macro_derive(ToJsError)]
pub fn derive_to_js_error(ts: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(ts as DeriveInput);

    let name_ident = input.ident;

    quote! {
        impl From<#name_ident> for js_sys::Error {
            fn from(value: #name_ident) -> js_sys::Error {
                js_sys::Error::new(&format!("{value}"))
            }
        }

        impl ToJsError for #name_ident {}
    }
    .into()
}
