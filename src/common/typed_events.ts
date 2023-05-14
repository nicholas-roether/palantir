import { IdentifierMap } from "./data_structures";

type EventHandler<E> = (event: E) => unknown;

class EventEmitter<M> {
	private readonly target: EventTarget;
	private readonly listeners: IdentifierMap<
		[type: string, handler: EventHandler<Event>]
	>;

	constructor() {
		this.target = new EventTarget();
		this.listeners = new IdentifierMap();
	}

	public on<T extends keyof M & string>(
		type: T,
		handler: EventHandler<M[T]>
	): number {
		const listener = (evt: Event): void => {
			if (!("detail" in evt)) return;
			handler(evt.detail as M[T]);
		};
		this.target.addEventListener(type, listener);
		return this.listeners.add([type, listener]);
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
		this.target.dispatchEvent(new CustomEvent(type, { detail: event }));
	}

	public removeListener(identifier: number): void {
		const entry = this.listeners.take(identifier);
		if (!entry) return;
		const [type, listener] = entry;
		this.target.removeEventListener(type, listener);
	}
}

export { EventHandler, EventEmitter };
