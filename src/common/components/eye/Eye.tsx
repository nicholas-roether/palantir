import { JSX, onCleanup, onMount } from "solid-js";

import fragShaderSource from "./glsl/eye.frag.glsl";
import vertShaderSource from "./glsl/eye.vert.glsl";

interface EyeProps {
	size: number;
}

function Eye({ size }: EyeProps): JSX.Element {
	let cvs!: HTMLCanvasElement;

	let renderer: EyeRenderer | null = null;

	onMount(() => {
		renderer?.stop();
		renderer = new EyeRenderer(cvs);
		renderer.start();
	});

	onCleanup(() => {
		renderer?.stop();
	});

	return <canvas width={size} height={size} ref={cvs} />;
}

class EyeRenderer {
	private static readonly FOV = (1 / 3) * Math.PI;
	private static readonly VERTICES = [
		1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0
	];
	private static readonly VERTEX_SIZE = 2;
	private static readonly NUM_VERTICES =
		this.VERTICES.length / this.VERTEX_SIZE;

	private readonly gl: WebGL2RenderingContext;
	private running = false;
	private lastFrameTime?: number;

	constructor(canvas: HTMLCanvasElement) {
		const webgl = canvas.getContext("webgl2");
		if (!webgl) {
			throw new Error("WebGL2 is not supported by your browser!");
		}
		this.gl = webgl;
	}

	public start(): void {
		this.running = true;
		this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
		this.gl.clearDepth(1.0);
		this.gl.enable(this.gl.DEPTH_TEST);
		this.gl.depthFunc(this.gl.LEQUAL);
		this.gl.viewport(
			0,
			0,
			this.gl.drawingBufferWidth,
			this.gl.drawingBufferHeight
		);
		console.log(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

		const shaderProgram = this.makeProgram(
			this.makeShader(this.gl.VERTEX_SHADER, vertShaderSource),
			this.makeShader(this.gl.FRAGMENT_SHADER, fragShaderSource)
		);
		this.gl.useProgram(shaderProgram);

		const positionLocation = this.gl.getAttribLocation(
			shaderProgram,
			"vertex_position"
		);
		const vertexBuffer = this.makeBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Float32Array(EyeRenderer.VERTICES),
			this.gl.STATIC_DRAW
		);
		this.gl.vertexAttribPointer(
			0,
			EyeRenderer.VERTEX_SIZE,
			this.gl.FLOAT,
			false,
			0,
			0
		);
		this.gl.enableVertexAttribArray(positionLocation);

		this.setUniformFloat(
			shaderProgram,
			"aspect_ratio",
			this.gl.drawingBufferWidth / this.gl.drawingBufferHeight
		);
		this.setUniformFloat(shaderProgram, "field_of_view", EyeRenderer.FOV);

		this.run();
	}

	public stop(): void {
		this.running = false;
	}

	private async run(): Promise<void> {
		while (this.running) {
			await this.runFrame();
		}
	}

	private runFrame(): Promise<void> {
		return new Promise((res) =>
			requestAnimationFrame((time) => {
				if (this.lastFrameTime) {
					const dt = time - this.lastFrameTime;
					this.update(dt);
				}
				this.lastFrameTime = time;
				this.render();
				res();
			})
		);
	}

	private update(dt: number): void {
		// TODO do something here
	}

	private render(): void {
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, EyeRenderer.NUM_VERTICES);
	}

	private makeShader(type: number, source: string): WebGLShader {
		const shader = this.gl.createShader(type);
		if (!shader) throw new Error("Failed to create WebGL shader");

		this.gl.shaderSource(shader, source);
		this.gl.compileShader(shader);

		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
			this.gl.deleteShader(shader);
			throw new Error(
				`Failed to compile WebGL shader: ${this.gl.getShaderInfoLog(shader)}`
			);
		}

		return shader;
	}

	private makeProgram(...shaders: WebGLShader[]): WebGLProgram {
		const program = this.gl.createProgram();
		if (!program) throw new Error("Failed to create WebGL shader program");

		for (const shader of shaders) this.gl.attachShader(program, shader);
		this.gl.linkProgram(program);

		if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
			this.gl.deleteProgram(program);
			throw new Error(
				`Failed to link shader program: ${this.gl.getProgramInfoLog(program)}`
			);
		}

		return program;
	}

	private makeBuffer(): WebGLBuffer {
		const buffer = this.gl.createBuffer();
		if (!buffer) throw new Error("Failed to create WebGL buffer");
		return buffer;
	}

	private setUniformFloat(
		program: WebGLProgram,
		name: string,
		value: number
	): void {
		this.gl.uniform1f(this.gl.getUniformLocation(program, name), value);
	}
}

export default Eye;

export { EyeProps };
