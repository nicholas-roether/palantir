import ty, { checkType } from "lifeboat";
import { MessagePort } from "../../common/message_port";
import {
	MediaSyncMessage,
	Message,
	MessageType,
	RequestMediaHeartbeatMessage,
	SessionCloseReason
} from "../../common/messages";
import { EventEmitter } from "../../common/event_emitter";
import mediaSyncLogger from "./logger";
import { Packet } from "../p2p";
import PacketType from "../packets";

const log = mediaSyncLogger.sub("controller");

const syncMediaPacketSchema = ty.object({
	playing: ty.boolean(),
	time: ty.number(),
	timestamp: ty.number()
});

class MediaController extends EventEmitter<{
	packet: Packet;
	close: SessionCloseReason;
}> {
	private readonly port: MessagePort;
	private readonly messageListener: number;
	private readonly closeListener: number;

	constructor(port: MessagePort) {
		super();
		this.port = port;
		this.messageListener = this.port.on("message", ({ message }) =>
			this.onMessage(message)
		);
		this.closeListener = this.port.on("close", () =>
			this.emit("close", SessionCloseReason.DISCONNECTED)
		);
	}

	public handle(packet: Packet): void {
		if (packet.type != PacketType.SYNC_MEDIA) return;
		if (!checkType(syncMediaPacketSchema, packet)) {
			log.error(
				`Received invalid SYNC_MEDIA packet: ${syncMediaPacketSchema.reason}`
			);
			this.emit("close", SessionCloseReason.UNEXPECTED_PACKET);
			return;
		}

		log.debug(`Incoming media sync packet: ${JSON.stringify(packet)}`);
		this.port.post(
			new MediaSyncMessage(packet.playing, packet.time, packet.timestamp)
		);
	}

	public stop(): void {
		this.port.removeListener(this.messageListener);
		this.port.removeListener(this.closeListener);
		this.port.close();
	}

	public requestHeartbeat(): void {
		log.debug("Requesting media heartbeat");

		this.port.post(new RequestMediaHeartbeatMessage());
	}

	private onMessage(msg: Message): void {
		if (msg.type != MessageType.MEDIA_SYNC) return;
		log.debug(`Outgoing media sync event: ${JSON.stringify(msg)}`);
		this.emit("packet", {
			type: PacketType.SYNC_MEDIA,
			playing: msg.playing,
			time: msg.time,
			timestamp: Date.now()
		});
	}
}

export default MediaController;
