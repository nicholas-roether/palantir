import ty, { ValidatedBy } from "lifeboat";
import { VideoSyncAction } from "../common/messages";
import PacketType from "./packets";

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
	listen(): AsyncIterable<VideoSyncPacket>;
	send(packet: VideoSyncPacket): void;
}

class VideoSyncClient {
	private readonly backend: VideoSyncClientBackend;

	constructor(backend: VideoSyncClientBackend) {
		this.backend = backend;
	}
}

class VideoSyncServer {
	constructor() {
		throw new Error("Not implemented");
	}
}

export { VideoSyncClient, VideoSyncClientBackend, VideoSyncServer };
