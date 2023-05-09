import ty, { ValidatedBy, assertType } from "lifeboat";
import { VideoSyncAction, VideoSyncMessage } from "../common/messages";
import PacketType from "./packets";
import { EventEmitter } from "../common/typed_events";
import { Connection, Packet } from "./p2p";
import { IdentifierMap } from "../common/data_structures";
import { StartVideoSyncMessage } from "../common/messages";
import { StopVideoSyncMessage } from "../common/messages";
import { RedirectMessage } from "../common/messages";

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

const videoSyncStartPacketSchema = ty.object({
	href: ty.string(),
	query: ty.string()
});

type VideoSyncStartPacket = ValidatedBy<typeof videoSyncStartPacketSchema>;

interface VideoSyncAdapter {
	listen(): AsyncIterable<Packet>;
	send(packet: Packet): void;
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
	message:
		| VideoSyncMessage
		| StartVideoSyncMessage
		| StopVideoSyncMessage
		| RedirectMessage;
}

class VideoSyncClient extends EventEmitter<{ message: VideoSyncMessageEvent }> {
	private readonly backend: VideoSyncAdapter;
	private readonly heartbeat: boolean;
	private href: string | null = null;
	private query: string | null = null;
	private playing = false;
	private time = 0;

	constructor(backend: VideoSyncAdapter, heartbeat: boolean) {
		super();
		this.backend = backend;
		this.heartbeat = heartbeat;
	}

	public static remote(connection: Connection): VideoSyncClient {
		const adapter = new RemoteVideoSyncAdapter(connection);
		return new VideoSyncClient(adapter, false);
	}

	public async send(message: VideoSyncMessage): Promise<void> {
		await this.backend.send({
			type: PacketType.VIDEO_SYNC,
			timestamp: Date.now(),
			action: message.action,
			time: message.time
		});
	}

	private initContent(): void {
		if (this.query) {
			this.emit("message", {
				message: new StartVideoSyncMessage(this.query, this.heartbeat)
			});
			this.emit("message", {
				message: new VideoSyncMessage(
					this.playing ? VideoSyncAction.PLAY : VideoSyncAction.PAUSE,
					this.time
				)
			});
		} else {
			this.emit("message", { message: new StopVideoSyncMessage() });
		}
	}

	public async listen(): Promise<void> {
		for await (const packet of this.backend.listen()) this.onPacket(packet);
	}

	private onPacket(packet: Packet): void {
		switch (packet.type) {
			case PacketType.START_VIDEO_SYNC:
				assertType(videoSyncStartPacketSchema, packet);
				this.onStartSyncPacket(packet);
				break;
			case PacketType.VIDEO_SYNC:
				assertType(videoSyncPacketSchema, packet);
				this.onSyncPacket(packet);
				break;
			case PacketType.STOP_VIDEO_SYNC:
				this.onStopSyncPacket();
				break;
		}
	}

	private onStartSyncPacket(packet: VideoSyncStartPacket): void {
		this.resetPlayback();
		this.href = packet.href;
		this.query = packet.query;
		this.emit("message", {
			message: new RedirectMessage(this.href)
		});
	}

	private onSyncPacket(packet: VideoSyncPacket): void {
		let newTime = packet.time;
		switch (packet.action) {
			case VideoSyncAction.PLAY:
				this.playing = true;
				break;
			case VideoSyncAction.PAUSE:
				this.playing = false;
		}

		if (packet.action != VideoSyncAction.PAUSE && this.playing == true) {
			const travelTime = Date.now() - packet.timestamp;
			newTime += travelTime;
		}

		this.emit("message", {
			message: new VideoSyncMessage(packet.action, newTime)
		});
	}

	private onStopSyncPacket(): void {
		this.resetPlayback();
		this.emit("message", {
			message: new StopVideoSyncMessage()
		});
	}

	private resetPlayback(): void {
		this.href = null;
		this.query = null;
		this.playing = false;
		this.time = 0;
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
		return new VideoSyncClient(adp2, true);
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
