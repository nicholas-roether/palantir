use std::rc::Rc;

use palantir_wasm_macros::ToJsError;
use web_sys::{
	WebGl2RenderingContext, WebGlBuffer, WebGlProgram, WebGlShader, WebGlUniformLocation,
	WebGlVertexArrayObject
};

use yade::YadeError;
use WebGl2RenderingContext as Gl;

use crate::{console_warn, js_err::ToJsError};

#[derive(Clone)]
pub struct GlContext {
	gl: Rc<WebGl2RenderingContext>
}

#[derive(Debug, Clone, Copy)]
#[repr(u32)]
pub enum BufferBindingTarget {
	ArrayBuffer = Gl::ARRAY_BUFFER
}

#[derive(Debug, Clone, Copy)]
#[repr(u32)]
pub enum DrawMethod {
	TriangleStrip = Gl::TRIANGLE_STRIP
}

#[derive(Debug, YadeError, ToJsError)]
pub enum BufferCreationError {
	#[display(msg = "Failed to create WebGL buffer")]
	CreationFailed
}

#[derive(Debug, YadeError, ToJsError)]
pub enum VaoCreationError {
	#[display(msg = "Failed to create vertex array object")]
	CreationFailed
}

#[derive(Debug, Clone, Copy, YadeError)]
#[repr(u32)]
pub enum GlError {
	#[display(msg = "Invalid enum")]
	InvalidEnum = Gl::INVALID_ENUM,
	#[display(msg = "Invalid value")]
	InvalidValue = Gl::INVALID_VALUE,
	#[display(msg = "Invalid operation")]
	InvalidOperation = Gl::INVALID_OPERATION,
	#[display(msg = "Invalid framebuffer operation")]
	InvalidFramebufferOperation = Gl::INVALID_FRAMEBUFFER_OPERATION,
	#[display(msg = "Out of memory")]
	OutOfMemory = Gl::OUT_OF_MEMORY,
	#[display(msg = "WebGL context lost")]
	ContextLostWebgl = Gl::CONTEXT_LOST_WEBGL
}

impl GlError {
	fn from_gl_enum(gl_enum: u32) -> Option<Self> {
		match gl_enum {
			Gl::INVALID_ENUM => Some(Self::InvalidEnum),
			Gl::INVALID_VALUE => Some(Self::InvalidValue),
			Gl::INVALID_OPERATION => Some(Self::InvalidOperation),
			Gl::INVALID_FRAMEBUFFER_OPERATION => Some(Self::InvalidFramebufferOperation),
			Gl::OUT_OF_MEMORY => Some(Self::OutOfMemory),
			Gl::CONTEXT_LOST_WEBGL => Some(Self::ContextLostWebgl),
			_ => None
		}
	}
}

impl GlContext {
	pub fn new(raw_context: WebGl2RenderingContext) -> Self {
		GlContext {
			gl: Rc::new(raw_context)
		}
	}

	pub fn init(&self) {
		self.gl.clear_color(0.0, 0.0, 0.0, 0.0);
		self.gl.clear_depth(1.0);
		self.gl.enable(Gl::DEPTH_TEST);
		self.gl.depth_func(Gl::LEQUAL);
		self.gl.enable(Gl::BLEND);
		self.gl.blend_func(Gl::SRC_ALPHA, Gl::ONE_MINUS_SRC_ALPHA);
		self.gl.viewport(
			0,
			0,
			self.gl.drawing_buffer_width(),
			self.gl.drawing_buffer_height()
		);
		self.handle_errors("init");
	}

	pub fn width(&self) -> i32 {
		self.gl.drawing_buffer_width()
	}

	pub fn height(&self) -> i32 {
		self.gl.drawing_buffer_height()
	}

	pub fn make_shader_compiler(&self) -> ShaderCompiler {
		ShaderCompiler::new(self.clone())
	}

	pub fn use_program(&self, program: Option<&ShaderProgram>) {
		let Some(program) = program else {
			self.gl.use_program(None);
			return;
		};
		self.gl.use_program(Some(&program.program));
		self.handle_errors("use_program");

		program.configure_vertex_attrib_pointers();
	}

	pub fn make_buffer(&self) -> Result<Buffer, BufferCreationError> {
		let Some(buffer) = self.gl.create_buffer() else {
            return Err(BufferCreationError::CreationFailed);
        };
		Ok(Buffer(buffer))
	}

	pub fn get_buffer_binding(&self, target: BufferBindingTarget) -> BufferBinding {
		BufferBinding::new(self.clone(), target)
	}

	pub fn make_vao(&self) -> Result<VertexArray, VaoCreationError> {
		let Some(vao) = self.gl.create_vertex_array() else {
			return Err(VaoCreationError::CreationFailed)
		};
		Ok(VertexArray::new(self.clone(), vao))
	}

	pub fn bind_vao(&self, vao: Option<&VertexArray>) {
		self.gl.bind_vertex_array(vao.map(|v| &v.vao));
		self.handle_errors("bind_vao");
	}

	pub fn set_uniform_1_f32(&self, location: &UniformLocation, value: f32) {
		self.gl.uniform1f(Some(&location.0), value);
		self.handle_errors("set_uniform_1_f32");
	}

	pub fn clear(&self) {
		self.gl.clear(Gl::COLOR_BUFFER_BIT | Gl::DEPTH_BUFFER_BIT);
		self.handle_errors("clear");
	}

	pub fn draw(&self, method: DrawMethod, num_vertices: u16) {
		self.gl.draw_arrays(method as u32, 0, num_vertices as i32);
		self.handle_errors("draw");
	}

	pub fn get_error(&self) -> Option<GlError> {
		let error_enum = self.gl.get_error();
		GlError::from_gl_enum(error_enum)
	}

	fn handle_errors(&self, context: &str) {
		if let Some(error) = self.get_error() {
			console_warn!("WebGL error in \"{context}\": {error}");
		}
	}
}

pub struct VertexArray {
	ctx: GlContext,
	vao: WebGlVertexArrayObject
}

impl VertexArray {
	fn new(ctx: GlContext, vao: WebGlVertexArrayObject) -> Self {
		Self { ctx, vao }
	}
}

impl Drop for VertexArray {
	fn drop(&mut self) {
		self.ctx.gl.delete_vertex_array(Some(&self.vao));
	}
}

#[derive(Debug, Clone, Copy)]
#[repr(u32)]
pub enum GlType {
	Float = Gl::FLOAT
}

#[derive(Debug)]
struct VertexAttribute {
	index: u32,
	size: u16,
	attr_type: GlType,
	normalized: bool
}

pub struct ShaderProgram {
	ctx: GlContext,
	program: WebGlProgram,
	attributes: Vec<VertexAttribute>
}

#[derive(Debug, YadeError, ToJsError)]
pub enum AttributeConfigError {
	#[display(msg = "Vertex attribute \"{}\" does not exist", _0)]
	DoesNotExist(String)
}

#[derive(Debug, YadeError, ToJsError)]
pub enum GetUniformLocationError {
	#[display(msg = "Uniform \"{}\" does not exist", _0)]
	DoesNotExist(String)
}

impl ShaderProgram {
	fn new(ctx: GlContext, program: WebGlProgram) -> Self {
		Self {
			ctx,
			program,
			attributes: vec![]
		}
	}

	pub fn configure_attribute(
		&mut self,
		name: &str,
		size: u16,
		attr_type: GlType,
		normalized: bool
	) -> Result<(), AttributeConfigError> {
		let index = self.ctx.gl.get_attrib_location(&self.program, name);
		if index < 0 {
			return Err(AttributeConfigError::DoesNotExist(name.to_string()));
		}
		self.attributes.push(VertexAttribute {
			index: index as u32,
			size,
			attr_type,
			normalized
		});
		Ok(())
	}

	pub fn get_uniform_location(
		&self,
		name: &str
	) -> Result<UniformLocation, GetUniformLocationError> {
		let Some(location) = self.ctx.gl.get_uniform_location(&self.program, name) else {
			return Err(GetUniformLocationError::DoesNotExist(name.to_string()))
		};
		Ok(UniformLocation(location))
	}

	fn configure_vertex_attrib_pointers(&self) {
		let vertex_size: u16 = self.attributes.iter().map(|a| a.size).sum();
		let mut vertex_offset = 0u16;

		for attrib in &self.attributes {
			self.ctx.gl.vertex_attrib_pointer_with_i32(
				attrib.index,
				attrib.size as i32,
				attrib.attr_type as u32,
				attrib.normalized,
				(vertex_size - attrib.size) as i32,
				vertex_offset as i32
			);
			vertex_offset += attrib.size;
		}
		self.ctx
			.handle_errors("ShaderProgram::configure_vertex_attrib_pointers");
	}
}

impl Drop for ShaderProgram {
	fn drop(&mut self) {
		self.ctx.gl.delete_program(Some(&self.program))
	}
}

#[derive(Debug, Clone, Copy)]
#[repr(u32)]
pub enum ShaderType {
	Vertex = Gl::VERTEX_SHADER,
	Fragment = Gl::FRAGMENT_SHADER
}

pub struct ShaderCompiler {
	ctx: GlContext,
	shaders: Vec<WebGlShader>
}

#[derive(Debug, YadeError, ToJsError)]
pub enum CompilationError {
	#[display(msg = "Failed to create WebGL shader")]
	CreationFailed,
	#[display(msg = "Shader compilation failed: {}", _0)]
	CompilationFailed(String)
}

#[derive(Debug, YadeError, ToJsError)]
pub enum LinkingError {
	#[display(msg = "Failed to create WebGL shader program")]
	CreationFailed,
	#[display(msg = "Shader program linking failed: {}", _0)]
	LinkingFailed(String)
}

impl ShaderCompiler {
	fn new(ctx: GlContext) -> Self {
		Self {
			ctx,
			shaders: vec![]
		}
	}

	pub fn compile(
		&mut self,
		shader_type: ShaderType,
		source: &'static str
	) -> Result<(), CompilationError> {
		let Some(shader) = self.ctx.gl.create_shader(shader_type as u32) else {
            return Err(CompilationError::CreationFailed);
        };

		self.ctx.gl.shader_source(&shader, source);
		self.ctx.gl.compile_shader(&shader);

		let compilation_succeeded = self
			.ctx
			.gl
			.get_shader_parameter(&shader, Gl::COMPILE_STATUS)
			.is_truthy();

		if !compilation_succeeded {
			let message = self
				.ctx
				.gl
				.get_shader_info_log(&shader)
				.unwrap_or("Unknown compilation error".to_string());
			self.ctx.gl.delete_shader(Some(&shader));
			return Err(CompilationError::CompilationFailed(message));
		}

		self.shaders.push(shader);
		Ok(())
	}

	pub fn link(self) -> Result<ShaderProgram, LinkingError> {
		let Some(program) = self.ctx.gl.create_program() else {
            return Err(LinkingError::CreationFailed);
        };

		for shader in &self.shaders {
			self.ctx.gl.attach_shader(&program, shader);
		}
		self.ctx.gl.link_program(&program);

		let linking_succeeded = self
			.ctx
			.gl
			.get_program_parameter(&program, Gl::LINK_STATUS)
			.is_truthy();

		if !linking_succeeded {
			let message = self
				.ctx
				.gl
				.get_program_info_log(&program)
				.unwrap_or("Unknown linking error".to_string());
			self.ctx.gl.delete_program(Some(&program));
			return Err(LinkingError::LinkingFailed(message));
		}

		Ok(ShaderProgram::new(self.ctx.clone(), program))
	}
}

impl Drop for ShaderCompiler {
	fn drop(&mut self) {
		for shader in &self.shaders {
			self.ctx.gl.delete_shader(Some(&shader));
		}
	}
}

pub struct Buffer(WebGlBuffer);

#[derive(Debug, Clone, Copy)]
#[repr(u32)]
pub enum BufferUsageHint {
	StaticDraw = Gl::STATIC_DRAW
}

pub struct BufferBinding {
	ctx: GlContext,
	target: BufferBindingTarget
}

impl BufferBinding {
	fn new(ctx: GlContext, target: BufferBindingTarget) -> Self {
		Self { ctx, target }
	}

	pub fn bind(&self, buffer: Option<&Buffer>) {
		self.ctx
			.gl
			.bind_buffer(self.target as u32, buffer.map(|b| &b.0));
		self.ctx.handle_errors("BufferBinding::bind");
	}

	pub fn write(&self, data: &js_sys::Object, usage: BufferUsageHint) {
		self.ctx
			.gl
			.buffer_data_with_array_buffer_view(self.target as u32, &data, usage as u32);
		self.ctx.handle_errors("BufferBinding::write");
	}
}

pub struct UniformLocation(WebGlUniformLocation);
