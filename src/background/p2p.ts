import * as peerjs from "peerjs";
import ty, { ValidatedBy, checkType } from "lifeboat";
import { promiseWithTimeout } from "../common/utils";
import backgroundLogger from "./logger";
import { EventEmitter } from "../common/typed_events";

const p2pLogger = backgroundLogger.sub("p2p");

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
	private listening = false;

	constructor(handler: ConnectionHandler) {
		p2pLogger.debug("Opening new peer...");

		this.peer = new peerjs.Peer();
		this.handler = handler;
		this.connections = new Set();

		this.openPromise = this.awaitOpen().catch(() => this.close());

		this.peer.on("connection", async (conn) => {
			if (!this.listening) {
				await conn.close();
				return;
			}

			p2pLogger.debug(
				`Peer ${await this.getId()} received incoming connection from ${
					conn.peer
				}`
			);
			this.handleConnection(conn);
		});
	}

	public async getId(): Promise<string> {
		await this.openPromise;
		return this.peer.id;
	}

	public async listen(): Promise<void> {
		p2pLogger.debug(
			`Peer ${await this.getId()} is listening for incoming connections`
		);

		this.listening = true;
	}

	public async connectTo(remoteId: string): Promise<void> {
		p2pLogger.debug(
			`Peer ${await this.getId()} is connecting to remote peer ${remoteId}`
		);

		const conn = this.peer.connect(remoteId);
		this.handleConnection(conn);
	}

	public close(): void {
		for (const conn of this.connections) {
			conn.close();
		}
	}

	private handleConnection(connection: peerjs.DataConnection): void {
		const timeout = setTimeout(() => {
			p2pLogger.error(
				`Connection with ${connection.peer} was never opened!`
			);
			connection.close();
		}, OPEN_TIMEOUT);
		connection.addListener("open", () => {
			clearTimeout(timeout);
			p2pLogger.debug(`Connection with ${connection.peer} opened`);
			const conn = new Connection(connection);
			this.connections.add(conn);
			conn.on("close", () => this.connections.delete(conn));
			this.handler(conn);
		});
	}

	private awaitOpen(): Promise<void> {
		return new Promise((res, rej) => {
			const timeout = setTimeout(() => {
				p2pLogger.error("Timeout when opening peer!");
				rej(new Error("Peer opening timed out"));
			}, OPEN_TIMEOUT);
			this.peer.on("open", () => {
				clearTimeout(timeout);
				p2pLogger.debug(
					`Peer successfully opened on id ${this.peer.id}`
				);
				res(undefined);
			});
		});
	}
}

interface ConnectionEventMap {
	close: void;
}

type Resolver<T> = (val: T | null) => void;

class Connection extends EventEmitter<ConnectionEventMap> {
	private readonly connection: peerjs.DataConnection;
	private readonly packetResolvers: [
		res: Resolver<Packet | null>,
		rej: Resolver<Error>
	][];

	constructor(connection: peerjs.DataConnection) {
		super();
		this.connection = connection;
		this.connection.on("data", (data) => this.onData(data));
		this.connection.on("close", () => this.onClose());
		this.connection.on("error", (err) => this.onError(err));

		this.packetResolvers = [];
	}

	public get remoteId(): string {
		return this.connection.peer;
	}

	public async expectIncoming(timeout: number): Promise<Packet | null> {
		return await promiseWithTimeout(this.nextPacket(), null, timeout);
	}

	public async *listen(): AsyncGenerator<Packet, void, void> {
		const packet = await this.nextPacket();
		if (!packet) return;
		yield packet;
	}

	public nextPacket(): Promise<Packet | null> {
		return new Promise((res, rej) => {
			this.addResolver(res, rej);
		});
	}

	public send(data: Packet): void {
		this.connection.send(data);
	}

	public close(): void {
		this.connection.close();
	}

	private addResolver(
		res: Resolver<Packet | null>,
		rej: Resolver<Error>
	): void {
		if (!this.connection.open) res(null);
		else this.packetResolvers.push([res, rej]);
	}

	private handlePacket(packet: Packet | null): void {
		let resolvers;
		while ((resolvers = this.packetResolvers.pop())) resolvers[0](packet);
	}

	private handleError(error: Error): void {
		let resolvers;
		while ((resolvers = this.packetResolvers.pop())) resolvers[1](error);
	}

	private closeResolvers(): void {
		this.handlePacket(null);
	}

	private onData(data: unknown): void {
		if (checkType(packetSchema, data)) {
			this.handlePacket(data);
		} else {
			p2pLogger.error(
				`Received malformed data from remote peer: ${packetSchema.reason}. Terminating connection.`
			);
			this.close();
		}
	}

	private onClose(): void {
		p2pLogger.debug(`Connection with ${this.remoteId} closed`);

		this.closeResolvers();
		this.emit("close", undefined);
	}

	private onError(err: Error): void {
		p2pLogger.error(
			`Error in connection with ${this.remoteId}: ${err.message} (${err.name})`
		);
		this.handleError(err);
		this.close();
	}
}

export { Connection, Peer, ConnectionHandler, Packet };
