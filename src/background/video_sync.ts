import ty, { ValidatedBy, assertType } from "lifeboat";
import { VideoSyncAction, VideoSyncMessage } from "../common/messages";
import PacketType from "./packets";
import { EventEmitter } from "../common/typed_events";
import { Connection } from "./p2p";
import { IdentifierMap } from "../common/data_structures";

const videoSyncPacketSchema = ty.object({
	type: ty.equals(PacketType.VIDEO_SYNC as const),
	timestamp: ty.number(),
	action: ty.enum(
		VideoSyncAction.PLAY,
		VideoSyncAction.PAUSE,
		VideoSyncAction.SYNC
	),
	time: ty.number()
});

type VideoSyncPacket = ValidatedBy<typeof videoSyncPacketSchema>;

interface VideoSyncAdapter {
	listen(): AsyncIterable<VideoSyncPacket>;
	send(packet: VideoSyncPacket): void;
}

class RemoteVideoSyncAdapter implements VideoSyncAdapter {
	private readonly connection: Connection;

	constructor(connection: Connection) {
		this.connection = connection;
	}

	public async *listen(): AsyncGenerator<VideoSyncPacket, void, void> {
		for await (const packet of this.connection.listen()) {
			if (packet.type != PacketType.VIDEO_SYNC) continue;
			assertType(videoSyncPacketSchema, packet);
			yield packet;
		}
	}

	public send(packet: VideoSyncPacket): void {
		this.connection.send(packet);
	}
}

class LocalVideoSyncAdapter
	extends EventEmitter<{
		incoming: VideoSyncPacket | null;
		outgoing: VideoSyncPacket;
	}>
	implements VideoSyncAdapter
{
	public async *listen(): AsyncGenerator<VideoSyncPacket, void, void> {
		while (true) {
			const packet = await new Promise<VideoSyncPacket | null>((res) => {
				const id = this.on("incoming", (packet) => {
					res(packet);
					this.removeListener(id);
				});
			});
			if (!packet) return;
			yield packet;
		}
	}

	public send(packet: VideoSyncPacket): void {
		this.emit("outgoing", packet);
	}

	public static makeBridge(): [LocalVideoSyncAdapter, LocalVideoSyncAdapter] {
		const adapter1 = new LocalVideoSyncAdapter();
		const adapter2 = new LocalVideoSyncAdapter();
		adapter1.on("outgoing", (packet) => adapter2.emit("incoming", packet));
		adapter2.on("outgoing", (packet) => adapter1.emit("incoming", packet));
		return [adapter1, adapter2];
	}
}

interface VideoSyncMessageEvent {
	message: VideoSyncMessage;
}

class VideoSyncClient extends EventEmitter<{ message: VideoSyncMessageEvent }> {
	private readonly backend: VideoSyncAdapter;

	constructor(backend: VideoSyncAdapter) {
		super();
		this.backend = backend;
	}

	public static remote(connection: Connection): VideoSyncClient {
		const adapter = new RemoteVideoSyncAdapter(connection);
		return new VideoSyncClient(adapter);
	}

	public async send(message: VideoSyncMessage): Promise<void> {
		await this.backend.send({
			type: PacketType.VIDEO_SYNC,
			timestamp: message.timestamp,
			action: message.action,
			time: message.time
		});
	}

	public async listen(): Promise<void> {
		for await (const packet of this.backend.listen()) this.onPacket(packet);
	}

	private async onPacket(packet: VideoSyncPacket): Promise<void> {
		this.emit("message", {
			message: new VideoSyncMessage(
				packet.timestamp,
				packet.action,
				packet.time
			)
		});
	}
}

class VideoSyncServer {
	private readonly connections: IdentifierMap<VideoSyncAdapter>;

	constructor() {
		this.connections = new IdentifierMap();
	}

	public addRemote(connection: Connection): number {
		return this.addConnection(new RemoteVideoSyncAdapter(connection));
	}

	public removeRemote(identifier: number): void {
		this.connections.remove(identifier);
	}

	public createLocalClient(): VideoSyncClient {
		const [adp1, adp2] = LocalVideoSyncAdapter.makeBridge();
		this.addConnection(adp1);
		return new VideoSyncClient(adp2);
	}

	private addConnection(connection: VideoSyncAdapter): number {
		const identifier = this.connections.add(connection);
		this.listenOn(identifier, connection);
		return identifier;
	}

	private async listenOn(
		identifier: number,
		connection: VideoSyncAdapter
	): Promise<void> {
		for await (const packet of connection.listen()) {
			if (!this.connections.has(identifier)) break;
			for (const conn of this.connections) {
				if (conn == connection) continue;
				conn.send(packet);
			}
		}
	}
}

export { VideoSyncClient, VideoSyncServer };
