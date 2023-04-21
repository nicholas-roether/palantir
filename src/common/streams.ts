class ChannelClosedError extends Error {
	constructor() {
		super("Tried to send on a channel that was already closed!");
	}
}

class Channel<T> implements AsyncIterator<T, void, void>, AsyncIterable<T> {
	private _isOpen = true;
	private readonly listeners: ((value: T) => void)[];

	constructor() {
		this.listeners = [];
	}

	public async next(): Promise<IteratorResult<T, void>> {
		if (!this._isOpen) return { done: true, value: undefined };
		const value = await new Promise<T>((res) => this.listeners.push(res));
		return { done: false, value };
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

	public send(value: T): void {
		if (!this._isOpen) throw new ChannelClosedError();

		let listener: ((value: T) => void) | undefined;
		while ((listener = this.listeners.pop())) {
			listener(value);
		}
	}

	public close(): void {
		this._isOpen = false;
	}

	public [Symbol.asyncIterator](): AsyncIterator<T, void, void> {
		return this;
	}
}

class InputStream<T> implements AsyncIterator<T, void, void>, AsyncIterable<T> {
	private readonly channel: Channel<T>;

	constructor(channel: Channel<T>) {
		this.channel = channel;
	}

	public get isOpen(): boolean {
		return this.channel.isOpen;
	}

	public async next(): Promise<IteratorResult<T, void>> {
		return await this.channel.next();
	}

	public async *map<O>(
		fn: (input: T) => O | Promise<O>
	): AsyncGenerator<O, void, void> {
		while (true) {
			const res = await this.next();
			if (res.done) return;
			yield await fn(res.value);
		}
	}

	public async *filter(
		fn: (input: T) => boolean
	): AsyncGenerator<T, void, void> {
		while (true) {
			const res = await this.next();
			if (res.done) return;
			if (!fn(res.value)) continue;
			yield res.value;
		}
	}

	public [Symbol.asyncIterator](): AsyncIterator<T, void, void> {
		return this.channel;
	}
}

class OutputStream<T> {
	private readonly channel: Channel<T>;

	constructor(channel: Channel<T>) {
		this.channel = channel;
	}

	public get isOpen(): boolean {
		return this.channel.isOpen;
	}

	public send(value: T): void {
		this.channel.send(value);
	}
}

class InputStreamController<T> {
	private readonly channel: Channel<T>;

	constructor() {
		this.channel = new Channel();
	}

	public createStream(): InputStream<T> {
		return new InputStream(this.channel);
	}

	public close(): void {
		this.channel.close();
	}

	public send(value: T): void {
		this.channel.send(value);
	}
}

class OutputStreamController<T> {
	private readonly channel: Channel<T>;
	private readonly handler: (value: T) => unknown;

	constructor(handler: (value: T) => unknown) {
		this.channel = new Channel();
		this.handler = handler;

		this.listen();
	}

	public createStream(): OutputStream<T> {
		return new OutputStream(this.channel);
	}

	public close(): void {
		this.channel.close();
	}

	private async listen(): Promise<void> {
		for await (const val of this.channel) {
			this.handler(val);
		}
	}
}

export {
	Channel,
	InputStream,
	OutputStream,
	InputStreamController,
	OutputStreamController
};
