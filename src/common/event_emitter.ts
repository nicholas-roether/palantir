import { IdentifierMap } from "./data_structures";

type EventHandler<E> = (event: E) => unknown;

class EventEmitter<M> {
	private readonly target: EventTarget;
	private readonly listeners: IdentifierMap<
		[type: string, handler: EventHandler<unknown>]
	>;

	constructor() {
		this.target = new EventTarget();
		this.listeners = new IdentifierMap();
	}

	public on<T extends keyof M & string>(
		type: T,
		handler: EventHandler<M[T]>
	): number {
		return this.listeners.add([type, handler as EventHandler<unknown>]);
	}

	public once<T extends keyof M & string>(type: T): Promise<M[T]> {
		return new Promise((res) => {
			const id = this.on(type, (evt) => {
				res(evt);
				this.removeListener(id);
			});
		});
	}

	protected emit<T extends keyof M & string>(type: T, event: M[T]): void {
		for (const [evtName, listener] of this.listeners) {
			if (evtName != type) continue;
			listener(event);
		}
	}

	public removeListener(identifier: number): void {
		const entry = this.listeners.take(identifier);
		if (!entry) return;
		const [target, handler] = entry;
		this.target.removeEventListener(target, handler);
	}
}

export { EventHandler, EventEmitter };
