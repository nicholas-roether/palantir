import { Channel } from "./streams";

interface StreamEvent<Ty> {
	readonly type: Ty;
}

class EventStreamController<Ty, E extends StreamEvent<Ty>> {
	private readonly channel: Channel<E>;

	constructor() {
		this.channel = new Channel();
	}

	public emit(event: E): void {
		this.channel.send(event);
	}

	public createStream(): EventStream<Ty, E> {
		return new EventStream(this.channel);
	}
}

class EventStream<Ty, E extends StreamEvent<Ty>> {
	private readonly channel: Channel<E>;

	constructor(channel: Channel<E>) {
		this.channel = channel;
	}

	public on<T extends Ty>(
		type: T,
		listener: (event: E & StreamEvent<T>) => unknown | Promise<unknown>
	): void {
		this.listen(type, listener);
	}

	private async listen<T extends Ty>(
		type: T,
		listener: (event: E & StreamEvent<T>) => unknown | Promise<unknown>
	): Promise<void> {
		for await (const event of this.channel) {
			if (event.type != type) continue;
			await listener(event as E & StreamEvent<T>);
		}
	}
}

export { StreamEvent, EventStreamController, EventStream };
