import type * as wasm from "palantir-wasm";
import { JSX, onCleanup, /* onCleanup, */ onMount } from "solid-js";

const wasmImport = import("palantir-wasm");

interface EyeProps {
	size: number;
}

function Eye({ size }: EyeProps): JSX.Element {
	let cvs!: HTMLCanvasElement;

	let renderer: EyeRenderer | null = null;

	onMount(async () => {
		renderer?.stop();
		const wasm = await wasmImport;
		const ctx = cvs.getContext("webgl2");
		if (!ctx) {
			throw new Error("This browser does not support WebGL2!");
		}
		renderer = new EyeRenderer(new wasm.Renderer(ctx));
		renderer?.start(), 10000;
	});

	onCleanup(() => {
		renderer?.stop();
	});

	return <canvas width={size} height={size} ref={cvs} />;
}

class EyeRenderer {
	private readonly renderer: wasm.Renderer;
	private running = false;
	private lastFrame: number | null = null;

	constructor(renderer: wasm.Renderer) {
		this.renderer = renderer;
	}

	public start(): void {
		this.running = true;
		this.frameLoop();
	}

	public stop(): void {
		this.running = false;
		this.renderer.free();
	}

	private frameLoop(): void {
		requestAnimationFrame((time) => {
			if (!this.running) return;
			this.onFrame(time);
			this.frameLoop();
		});
	}

	private onFrame(time: number): void {
		let dt = 0;
		if (this.lastFrame) dt = time - this.lastFrame;

		this.renderer.update(dt);
		this.renderer.draw();

		this.lastFrame = time;
	}
}

export default Eye;

export { EyeProps };
