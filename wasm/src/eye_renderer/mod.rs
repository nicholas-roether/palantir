// use std::f32::consts::PI;

use wasm_bindgen::prelude::*;
use web_sys::WebGl2RenderingContext;

use crate::eye_renderer::gl::{
	BufferBindingTarget, BufferUsageHint, DrawMethod, GlContext, GlType, ShaderType
};

use self::gl::{Buffer, BufferBinding, ShaderProgram, UniformLocation, VertexArray};

mod gl;

const VERTEX_SHADER_SOURCE: &str = include_str!("./shaders/eye.vert.glsl");
const FRAGMENT_SHADER_SOURCE: &str = include_str!("./shaders/eye.frag.glsl");

#[allow(dead_code)]
struct Vertex {
	x: f32,
	y: f32
}

impl Vertex {
	const SIZE: usize = 2;
}

const VERTICES: [Vertex; 4] = [
	Vertex { x: 1.0, y: 1.0 },
	Vertex { x: -1.0, y: 1.0 },
	Vertex { x: 1.0, y: -1.0 },
	Vertex { x: -1.0, y: -1.0 }
];

#[wasm_bindgen]
pub struct Renderer {
	ctx: GlContext,
	_vao: VertexArray,
	_shaders: ShaderProgram,
	_uniform_aspect_ratio: UniformLocation,
	_array_buffer_binding: BufferBinding,
	_vertex_buffer: Buffer
}

#[wasm_bindgen]
impl Renderer {
	#[wasm_bindgen(constructor)]
	pub fn new(raw_ctx: WebGl2RenderingContext) -> Result<Renderer, js_sys::Error> {
		let ctx = GlContext::new(raw_ctx);
		ctx.init();

		let vao = ctx.make_vao()?;
		ctx.bind_vao(Some(&vao));

		let mut compiler = ctx.make_shader_compiler();
		compiler.compile(ShaderType::Vertex, VERTEX_SHADER_SOURCE)?;
		compiler.compile(ShaderType::Fragment, FRAGMENT_SHADER_SOURCE)?;
		let mut shaders = compiler.link()?;

		shaders.configure_attribute("vertex_position", 2, GlType::Float, false)?;
		let uniform_aspect_ratio = shaders.get_uniform_location("aspect_ratio")?;

		let array_buffer_binding = ctx.get_buffer_binding(BufferBindingTarget::ArrayBuffer);
		let vertex_buffer = ctx.make_buffer()?;
		array_buffer_binding.bind(Some(&vertex_buffer));

		unsafe {
			let vertex_data = js_sys::Float32Array::view_mut_raw(
				VERTICES.as_ptr() as *mut f32,
				VERTICES.len() * Vertex::SIZE
			);
			array_buffer_binding.write(&vertex_data, BufferUsageHint::StaticDraw)
		};

		ctx.use_program(Some(&shaders));

		ctx.set_uniform_1_f32(
			&uniform_aspect_ratio,
			(ctx.width() as f32) / (ctx.height() as f32)
		);

		Ok(Self {
			ctx,
			_vao: vao,
			_shaders: shaders,
			_uniform_aspect_ratio: uniform_aspect_ratio,
			_array_buffer_binding: array_buffer_binding,
			_vertex_buffer: vertex_buffer
		})
	}

	pub fn update(&mut self, _dt: f64) {
		// TODO
	}

	pub fn draw(&self) {
		self.ctx.clear();
		self.ctx
			.draw(DrawMethod::TriangleStrip, VERTICES.len() as u16);
	}
}
