import * as peerjs from "peerjs";

type ConnectionHandler = (connection: Connection) => Promise<void> | void;

class Peer {
	private readonly peer: peerjs.Peer;
	private readonly handler: ConnectionHandler;

	constructor(handler: ConnectionHandler) {
		this.peer = new peerjs.Peer();
		this.handler = handler;

		this.peer.on("connection", (conn) => this.handleConnection(conn));
	}

	public get id(): string {
		return this.peer.id;
	}

	public connectTo(remoteId: string): void {
		const conn = this.peer.connect(remoteId);
		this.handleConnection(conn);
	}

	private handleConnection(connection: peerjs.DataConnection) {
		this.handler(new Connection(connection));
	}
}

class Connection {
	private readonly connection: peerjs.DataConnection;
	private dataStreamController: ReadableStreamDefaultController<unknown> | null =
		null;
	public readonly incoming: ReadableStream<unknown>;
	public readonly outgoing: WritableStream<unknown>;

	constructor(connection: peerjs.DataConnection) {
		this.connection = connection;
		this.connection.on("data", (data) => this.onData(data));
		this.connection.on("close", () => this.onClose());
		this.connection.on("error", (err) => this.onError(err));

		this.incoming = new ReadableStream({
			start: (controller) => {
				this.dataStreamController = controller;
			}
		});

		this.outgoing = new WritableStream({
			write: (chunk) => {
				this.sendData(chunk);
			}
		});
	}

	public close() {
		this.connection.close();
	}

	private sendData(data: unknown): void {
		this.connection.send(data);
	}

	private onData(data: unknown): void {
		this.dataStreamController?.enqueue(data);
	}

	private onClose(): void {
		this.dataStreamController?.close();
	}

	private onError(err: Error): void {
		this.dataStreamController?.error(err);
	}
}

export { Connection, Peer, ConnectionHandler };
