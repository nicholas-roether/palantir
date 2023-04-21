import ty, { ValidatedBy, checkType } from "lifeboat";
import { VideoSyncAction, VideoSyncMessage } from "../common/messages";
import {
	InputStream,
	InputStreamController,
	OutputStream,
	OutputStreamController
} from "../common/streams";
import PacketType from "./packets";
import { Connection } from "./p2p";
import backgroundLogger from "./logger";

const videoSyncLogger = backgroundLogger.sub("video_sync");

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

interface VideoSyncClientBackend {
	getIncomingStream(): AsyncIterable<VideoSyncPacket>;
	sendPacket(packet: VideoSyncPacket): void;
}

class VideoSyncClientLocalBackend implements VideoSyncClientBackend {
	private readonly server: VideoSyncServer;

	constructor(server: VideoSyncServer) {
		this.server = server;
	}

	public getIncomingStream(): AsyncIterable<VideoSyncPacket> {
		return this.server.receive;
	}

	public sendPacket(packet: VideoSyncPacket): void {
		this.server.broadcast.send(packet);
	}
}

class VideoSyncClientRemoteBackend implements VideoSyncClientBackend {
	private readonly connection: Connection;

	constructor(connection: Connection) {
		this.connection = connection;
	}

	public getIncomingStream(): AsyncIterable<VideoSyncPacket> {
		return this.connection.incoming.filter((packet) => {
			if (packet.type != PacketType.VIDEO_SYNC) return false;
			if (!checkType(videoSyncPacketSchema, packet)) {
				videoSyncLogger.error(
					`VideoSyncClient received malformed VIDEO_SYNC packet: ${videoSyncPacketSchema.reason}`
				);
				return false;
			}
			return true;
		}) as AsyncIterable<VideoSyncPacket>;
	}

	public sendPacket(packet: VideoSyncPacket): void {
		this.connection.outgoing.send(packet);
	}
}

class VideoSyncClient {
	public readonly incoming: InputStream<VideoSyncMessage>;
	public readonly outgoing: OutputStream<VideoSyncMessage>;

	private readonly incomingController: InputStreamController<VideoSyncMessage>;
	private readonly outgoingController: OutputStreamController<VideoSyncMessage>;
	private readonly backend: VideoSyncClientBackend;

	constructor(backend: VideoSyncClientBackend) {
		this.incomingController = new InputStreamController();
		this.incoming = this.incomingController.createStream();
		this.outgoingController = new OutputStreamController((message) => {
			this.sendPacket(message);
		});
		this.outgoing = this.outgoingController.createStream();
		this.backend = backend;
	}

	public async listen(): Promise<void> {
		for await (const packet of this.backend.getIncomingStream()) {
			this.incomingController.send(
				new VideoSyncMessage(
					packet.timestamp,
					packet.action,
					packet.time
				)
			);
		}
	}

	private sendPacket(message: VideoSyncMessage): void {
		this.backend.sendPacket({
			type: PacketType.VIDEO_SYNC,
			action: message.action,
			time: message.time,
			timestamp: message.timestamp
		});
	}
}

class VideoSyncServer {
	public readonly receive: InputStream<VideoSyncPacket>;
	public readonly broadcast: OutputStream<VideoSyncPacket>;

	private readonly receiveController: InputStreamController<VideoSyncPacket>;
	private readonly broadcastController: OutputStreamController<VideoSyncPacket>;

	constructor() {
		this.receiveController = new InputStreamController();
		this.receive = this.receiveController.createStream();

		this.broadcastController = new OutputStreamController((packet) => {
			this.handlePacket(packet);
		});
		this.broadcast = this.broadcastController.createStream();
	}

	private handlePacket(packet: VideoSyncPacket): void {
		// TODO
	}
}

export {
	VideoSyncClient,
	VideoSyncClientLocalBackend,
	VideoSyncClientRemoteBackend,
	VideoSyncClientBackend,
	VideoSyncServer
};
