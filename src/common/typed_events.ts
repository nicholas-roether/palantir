type EventHandler<E> = (event: E) => unknown;

abstract class EventEmitter<M> {
	private readonly target: EventTarget;

	constructor() {
		this.target = new EventTarget();
	}

	public on<T extends keyof M & string>(
		type: T,
		handler: EventHandler<M[T]>
	): void {
		this.target.addEventListener(type, (evt) => {
			if (!("detail" in evt)) return;
			handler(evt.detail as M[T]);
		});
	}

	public emit<T extends keyof M & string>(type: T, event: M[T]): void {
		this.target.dispatchEvent(new CustomEvent(type, { detail: event }));
	}
}

export { EventHandler, EventEmitter };
