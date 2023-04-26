type EventHandler<E> = (event: E) => unknown;

abstract class EventEmitter<M> {
	private readonly target: EventTarget;
	private readonly identifierMap: Map<
		number,
		[type: string, listener: EventHandler<Event>]
	>;
	private nextIdentifier: number;

	constructor() {
		this.target = new EventTarget();
		this.identifierMap = new Map();
		this.nextIdentifier = 0;
	}

	public on<T extends keyof M & string>(
		type: T,
		handler: EventHandler<M[T]>
	): number {
		const identifier = this.makeIdentifier();
		const listener = (evt: Event): void => {
			if (!("detail" in evt)) return;
			handler(evt.detail as M[T]);
		};
		this.target.addEventListener(type, listener);
		this.identifierMap.set(identifier, [type, listener]);
		return identifier;
	}

	public emit<T extends keyof M & string>(type: T, event: M[T]): void {
		this.target.dispatchEvent(new CustomEvent(type, { detail: event }));
	}

	public removeListener(identifier: number): void {
		const entry = this.identifierMap.get(identifier);
		if (!entry) return;
		const [type, listener] = entry;
		this.identifierMap.delete(identifier);
		this.target.removeEventListener(type, listener);
	}

	private makeIdentifier(): number {
		return this.nextIdentifier++;
	}
}

export { EventHandler, EventEmitter };
