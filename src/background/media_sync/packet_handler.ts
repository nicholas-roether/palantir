import ty, { checkType } from "lifeboat";
import { EventEmitter } from "../../common/typed_events";
import { Packet } from "../p2p";
import PacketType from "../packets";
import MediaController, {
	MediaPauseEvent,
	MediaPlayEvent,
	MediaSyncEvent
} from "./controller";
import mediaSyncLogger from "./logger";
import { MessagePort } from "../../common/message_port";

const log = mediaSyncLogger.sub("packetHandler");

const playMediaPacketSchema = ty.object({
	time: ty.number(),
	timestamp: ty.number()
});

const pauseMediaPacketSchema = ty.object({
	time: ty.number()
});

const syncMediaPacketSchema = ty.object({
	time: ty.number(),
	timestamp: ty.number()
});

class MediaSyncPacketHandler extends EventEmitter<{
	packet: Packet;
}> {
	private readonly controller: MediaController;
	private readonly playListener: number;
	private readonly pauseListener: number;
	private readonly syncListener: number;

	constructor(port: MessagePort) {
		super();

		this.controller = new MediaController(port);
		this.playListener = this.controller.on("play", (evt) =>
			this.onPlayEvent(evt)
		);
		this.pauseListener = this.controller.on("pause", (evt) =>
			this.onPauseEvent(evt)
		);
		this.syncListener = this.controller.on("sync", (evt) =>
			this.onSyncEvent(evt)
		);
	}

	public handle(packet: Packet): void {
		switch (packet.type) {
			case PacketType.PLAY_MEDIA:
				this.onPlayPacket(packet);
				break;
			case PacketType.PAUSE_MEDIA:
				this.onPausePacket(packet);
				break;
			case PacketType.SYNC_MEDIA:
				this.onSyncPacket(packet);
		}
	}

	public stop(): void {
		this.controller.removeListener(this.playListener);
		this.controller.removeListener(this.pauseListener);
		this.controller.removeListener(this.syncListener);
	}

	private onPlayEvent({ time, timestamp }: MediaPlayEvent): void {
		this.emit("packet", { type: PacketType.PLAY_MEDIA, time, timestamp });
	}

	private onPauseEvent({ time }: MediaPauseEvent): void {
		this.emit("packet", { type: PacketType.PAUSE_MEDIA, time });
	}

	private onSyncEvent({ time, timestamp }: MediaSyncEvent): void {
		this.emit("packet", { type: PacketType.SYNC_MEDIA, time, timestamp });
	}

	private onPlayPacket(packet: Packet): void {
		if (!checkType(playMediaPacketSchema, packet)) {
			log.error(
				`Got malformed PLAY_MEDIA packet: ${playMediaPacketSchema.reason}`
			);
			return;
		}
		this.controller.play(packet.time, packet.timestamp);
	}

	private onPausePacket(packet: Packet): void {
		if (!checkType(pauseMediaPacketSchema, packet)) {
			log.error(
				`Got malformed PAUSE_MEDIA packet: ${pauseMediaPacketSchema.reason}`
			);
			return;
		}
		this.controller.pause(packet.time);
	}

	private onSyncPacket(packet: Packet): void {
		if (!checkType(syncMediaPacketSchema, packet)) {
			log.error(
				`Got malformed SYNC_MEDIA packet: ${syncMediaPacketSchema.reason}`
			);
			return;
		}
		this.controller.sync(packet.time, packet.timestamp);
	}
}

export default MediaSyncPacketHandler;
