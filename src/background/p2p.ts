import * as peerjs from "peerjs";
import ty, { ValidatedBy, checkType } from "lifeboat";
import { promiseWithTimeout } from "../common/utils";

const packetSchema = ty.object({
	type: ty.number()
});

type Packet = ValidatedBy<typeof packetSchema> & Record<string, unknown>;

type ConnectionHandler = (connection: Connection) => Promise<void> | void;

const OPEN_TIMEOUT = 5000; // ms

class Peer {
	private readonly peer: peerjs.Peer;
	private readonly handler: ConnectionHandler;
	private readonly connections: Set<Connection>;
	private readonly openPromise: Promise<void>;

	constructor(handler: ConnectionHandler) {
		this.peer = new peerjs.Peer();
		this.handler = handler;
		this.connections = new Set();

		this.peer.on("connection", (conn) => this.handleConnection(conn));

		this.openPromise = this.awaitOpen().catch(() => this.close());
	}

	public async getId(): Promise<string> {
		await this.openPromise;
		return this.peer.id;
	}

	public connectTo(remoteId: string): void {
		const conn = this.peer.connect(remoteId);
		this.handleConnection(conn);
	}

	public async close(): Promise<void> {
		const closePromises: Promise<void>[] = [];
		for (const conn of this.connections) {
			closePromises.push(conn.close());
		}
		await Promise.all(closePromises);
	}

	private handleConnection(connection: peerjs.DataConnection): void {
		const conn = new Connection(connection);
		this.connections.add(conn);
		conn.addEventListener("close", () => this.connections.delete(conn));
		this.handler(conn);
	}

	private awaitOpen(): Promise<void> {
		return new Promise((res, rej) => {
			setTimeout(() => rej(new Error("Peer opening timed out")), OPEN_TIMEOUT);
			this.peer.on("open", () => res(undefined));
		});
	}
}

class ConnectionCloseEvent extends Event {
	constructor() {
		super("close");
	}
}

class Connection extends EventTarget {
	private readonly connection: peerjs.DataConnection;
	private dataStreamController: ReadableStreamDefaultController<Packet> | null =
		null;
	private readonly incomingStream: ReadableStream<Packet>;
	private readonly outgoingStream: WritableStream<Packet>;

	public readonly reader: ReadableStreamDefaultReader<Packet>;
	public readonly writer: WritableStreamDefaultWriter<Packet>;

	constructor(connection: peerjs.DataConnection) {
		super();
		this.connection = connection;
		this.connection.on("data", (data) => this.onData(data));
		this.connection.on("close", () => this.onClose());
		this.connection.on("error", (err) => this.onError(err));

		this.incomingStream = new ReadableStream({
			start: (controller) => {
				this.dataStreamController = controller;
			}
		});

		this.outgoingStream = new WritableStream({
			write: (chunk) => {
				this.sendData(chunk);
			}
		});

		this.reader = this.incomingStream.getReader();
		this.writer = this.outgoingStream.getWriter();
	}

	public async expectIncoming(timeout: number): Promise<Packet | null> {
		const res = await promiseWithTimeout(this.reader.read(), null, timeout);
		return res?.value ?? null;
	}

	public async close(): Promise<void> {
		this.connection.close();
		await this.incomingStream.cancel();
		await this.outgoingStream.close();
	}

	private sendData(data: unknown): void {
		this.connection.send(data);
	}

	private onData(data: unknown): void {
		if (checkType(packetSchema, data)) {
			this.dataStreamController?.enqueue(data);
		} else {
			console.error(
				`Received malformed data from remote peer: ${packetSchema.reason}. Terminating connection.`
			);
			this.close();
		}
	}

	private onClose(): void {
		this.dataStreamController?.close();
		this.dispatchEvent(new ConnectionCloseEvent());
	}

	private onError(err: Error): void {
		this.dataStreamController?.error(err);
	}
}

export { Connection, Peer, ConnectionHandler };
