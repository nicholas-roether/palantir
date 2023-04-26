function promiseWithTimeout<T>(
	promise: Promise<T>,
	defaultValue: T,
	timeout: number
): Promise<T> {
	return new Promise((res) => {
		setTimeout(() => res(defaultValue), timeout);
		promise.then((val) => res(val));
	});
}

class IdentifierMap<T> {
	private readonly map: Map<number, T>;
	private nextIdentifier: number;

	constructor() {
		this.map = new Map();
		this.nextIdentifier = 0;
	}

	public add(value: T): number {
		const identifier = this.makeIdentifier();
		this.map.set(identifier, value);
		return identifier;
	}

	public get(identifier: number): T | undefined {
		return this.map.get(identifier);
	}

	public remove(identifier: number): boolean {
		return this.map.delete(identifier);
	}

	public take(identifier: number): T | undefined {
		const value = this.get(identifier);
		this.remove(identifier);
		return value;
	}

	private makeIdentifier(): number {
		return this.nextIdentifier++;
	}
}

export { promiseWithTimeout, IdentifierMap };
