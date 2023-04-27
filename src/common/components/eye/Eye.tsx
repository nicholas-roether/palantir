import { JSX, onCleanup, onMount } from "solid-js";
import { makeNoise4D } from "fast-simplex-noise";

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

class NoiseTexture {
	private readonly buffer: Float32Array;
	private readonly getNoise: (
		x: number,
		y: number,
		z: number,
		t: number
	) => number;
	public readonly width: number;
	public readonly height: number;
	public readonly depth: number;
	private readonly scale: number;
	private readonly speed: number;
	private time = 0;

	constructor(
		width: number,
		height: number,
		depth: number,
		scale: number,
		speed: number
	) {
		this.buffer = new Float32Array(width * height * depth);
		this.width = width;
		this.height = height;
		this.depth = depth;
		this.scale = scale;
		this.speed = speed;
		this.getNoise = makeNoise4D();
		this.fillBuffer();
	}

	public update(dt: number): void {
		this.time += dt;
		this.fillBuffer();
	}

	public get data(): ArrayBufferView {
		return this.buffer;
	}

	private fillBuffer(): void {
		let index = 0;
		for (let z = 0; z < this.depth; z++) {
			for (let y = 0; y < this.height; y++) {
				for (let x = 0; x < this.width; x++) {
					this.buffer[index] = this.getNoise(
						x * this.scale,
						y * this.scale,
						z * this.scale,
						this.time * this.speed
					);
					index++;
				}
			}
		}
	}
}

class EyeRenderer {
	private static readonly FOV = (1 / 3) * Math.PI;
	private static readonly VERTICES = [
		1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0
	];
	private static readonly VERTEX_SIZE = 2;
	private static readonly NUM_VERTICES =
		this.VERTICES.length / this.VERTEX_SIZE;
	private static readonly NOISE_SCALE = 0.02;
	private static readonly NOISE_SPEED = 0.0004;
	private static readonly NOISE_SIZE = 50.0;

	private readonly gl: WebGL2RenderingContext;

	private readonly noiseTexture: NoiseTexture;
	private running = false;
	private lastFrameTime?: number;

	constructor(canvas: HTMLCanvasElement) {
		const webgl = canvas.getContext("webgl2");
		if (!webgl) {
			throw new Error("WebGL2 is not supported by your browser!");
		}
		this.gl = webgl;
		this.noiseTexture = new NoiseTexture(
			EyeRenderer.NOISE_SIZE,
			EyeRenderer.NOISE_SIZE,
			EyeRenderer.NOISE_SIZE,
			EyeRenderer.NOISE_SCALE,
			EyeRenderer.NOISE_SPEED
		);
	}

	public start(): void {
		this.running = true;
		this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
		this.gl.clearDepth(1.0);
		this.gl.enable(this.gl.DEPTH_TEST);
		this.gl.depthFunc(this.gl.LEQUAL);
		this.gl.enable(this.gl.BLEND);
		this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
		this.gl.viewport(
			0,
			0,
			this.gl.drawingBufferWidth,
			this.gl.drawingBufferHeight
		);

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
		Float32Array;
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

		const tex = this.gl.createTexture();
		this.gl.bindTexture(this.gl.TEXTURE_3D, tex);
		this.gl.texParameteri(
			this.gl.TEXTURE_3D,
			this.gl.TEXTURE_MIN_FILTER,
			this.gl.NEAREST
		);
		this.gl.texParameteri(
			this.gl.TEXTURE_3D,
			this.gl.TEXTURE_MAG_FILTER,
			this.gl.NEAREST
		);
		this.gl.texParameteri(
			this.gl.TEXTURE_3D,
			this.gl.TEXTURE_WRAP_S,
			this.gl.MIRRORED_REPEAT
		);
		this.gl.texParameteri(
			this.gl.TEXTURE_3D,
			this.gl.TEXTURE_WRAP_T,
			this.gl.MIRRORED_REPEAT
		);
		this.gl.texParameteri(
			this.gl.TEXTURE_3D,
			this.gl.TEXTURE_WRAP_R,
			this.gl.MIRRORED_REPEAT
		);
		this.gl.texStorage3D(
			this.gl.TEXTURE_3D,
			1,
			this.gl.R32F,
			this.noiseTexture.width,
			this.noiseTexture.height,
			this.noiseTexture.depth
		);

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
		this.noiseTexture.update(dt);
	}

	private render(): void {
		this.gl.texSubImage3D(
			this.gl.TEXTURE_3D,
			0,
			0,
			0,
			0,
			this.noiseTexture.width,
			this.noiseTexture.height,
			this.noiseTexture.depth,
			this.gl.RED,
			this.gl.FLOAT,
			this.noiseTexture.data
		);

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
