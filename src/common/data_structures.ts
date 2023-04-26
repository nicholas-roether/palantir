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

	public has(identifier: number): boolean {
		return this.map.has(identifier);
	}

	public remove(identifier: number): boolean {
		return this.map.delete(identifier);
	}

	public take(identifier: number): T | undefined {
		const value = this.get(identifier);
		this.remove(identifier);
		return value;
	}

	public [Symbol.iterator](): Iterator<T, void, void> {
		return this.map.values();
	}

	private makeIdentifier(): number {
		return this.nextIdentifier++;
	}
}

export { IdentifierMap };
