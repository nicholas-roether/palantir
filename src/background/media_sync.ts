import ty, { checkType } from "lifeboat";
import { MessagePort } from "../common/message_port";
import {
	Message,
	MessageType,
	MediaSyncAction,
	MediaSyncMessage
} from "../common/messages";
import { EventEmitter } from "../common/typed_events";
import { Connection, Packet } from "./p2p";
import PacketType from "./packets";
import backgroundLogger from "./logger";
import { PacketBus, PacketBusSubscription } from "./packet_bus";

const log = backgroundLogger.sub("mediaSync");

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

interface MediaPlayEvent {
	time: number;
	timestamp: number;
}

interface MediaPauseEvent {
	time: number;
}

interface MediaSyncEvent {
	time: number;
	timestamp: number;
}

class MediaController extends EventEmitter<{
	play: MediaPlayEvent;
	pause: MediaPauseEvent;
	sync: MediaSyncEvent;
	disconnect: void;
}> {
	private readonly port: MessagePort;
	private playing = false;

	constructor(port: MessagePort) {
		super();
		this.port = port;
		this.port.on("message", (msg) => this.onMessage(msg));
		this.port.on("close", () => this.emit("disconnect", undefined));
	}

	public play(time: number, timestamp: number): void {
		this.playing = true;
		this.port.post(
			new MediaSyncMessage(
				MediaSyncAction.PLAY,
				this.getAdjustedTime(time, timestamp)
			)
		);
	}

	public pause(time: number): void {
		this.playing = false;
		this.port.post(new MediaSyncMessage(MediaSyncAction.PAUSE, time));
	}

	public sync(time: number, timestamp: number): void {
		const adjustedTime = this.playing
			? this.getAdjustedTime(time, timestamp)
			: time;
		this.port.post(
			new MediaSyncMessage(MediaSyncAction.SYNC, adjustedTime)
		);
	}

	private onMessage(msg: Message): void {
		if (msg.type != MessageType.MEDIA_SYNC) return;
		switch (msg.action) {
			case MediaSyncAction.PLAY:
				this.emit("play", {
					time: msg.time,
					timestamp: Date.now()
				});
				break;
			case MediaSyncAction.PAUSE:
				this.emit("pause", {
					time: msg.time
				});
				break;
			case MediaSyncAction.SYNC:
				this.emit("sync", {
					time: msg.time,
					timestamp: Date.now()
				});
		}
	}

	private getAdjustedTime(time: number, timestamp: number): number {
		const travelTime = Date.now() - timestamp;
		return time + travelTime;
	}
}

class MediaSyncPacketHandler extends EventEmitter<{
	packet: Packet;
}> {
	private readonly controller: MediaController;
	private readonly playListener: number;
	private readonly pauseListener: number;
	private readonly syncListener: number;

	constructor(controller: MediaController) {
		super();

		this.controller = controller;
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

class MediaSyncClient {
	private readonly connection: Connection;
	private readonly handler: MediaSyncPacketHandler;
	private packetListener?: number;

	constructor(connection: Connection, controller: MediaController) {
		this.connection = connection;
		this.handler = new MediaSyncPacketHandler(controller);
	}

	public listen(): void {
		this.handler.on("packet", (packet) => this.connection.send(packet));
		this.packetListener = this.connection.on("packet", (packet) =>
			this.handler.handle(packet)
		);
	}

	public stop(): void {
		this.handler.stop();
		if (this.packetListener) {
			this.connection.removeListener(this.packetListener);
		}
	}
}

const MEDIA_PACKET_TYPES = [
	PacketType.PLAY_MEDIA,
	PacketType.PAUSE_MEDIA,
	PacketType.SYNC_MEDIA
];

interface MediaSyncSubscription {
	cancel(): void;
}

class LocalMediaSyncSubscription implements MediaSyncSubscription {
	private readonly subscription: PacketBusSubscription;
	private readonly handler: MediaSyncPacketHandler;

	constructor(
		subscription: PacketBusSubscription,
		controller: MediaController
	) {
		this.subscription = subscription;
		this.handler = new MediaSyncPacketHandler(controller);
		this.subscription.on("packet", (packet) => this.handler.handle(packet));
		this.handler.on("packet", (packet) => this.subscription.send(packet));
	}

	public cancel(): void {
		this.subscription.cancel();
		this.handler.stop();
	}
}

class RemoteMediaSyncSubscription implements MediaSyncSubscription {
	private readonly subscription: PacketBusSubscription;
	private readonly connection: Connection;
	private readonly incomingPacketListener: number;

	constructor(subscription: PacketBusSubscription, connection: Connection) {
		this.subscription = subscription;
		this.connection = connection;
		this.subscription.on("packet", (packet) =>
			this.connection.send(packet)
		);
		this.incomingPacketListener = this.connection.on("packet", (packet) =>
			this.onIncomingPacket(packet)
		);
	}

	private onIncomingPacket(packet: Packet): void {
		if (MEDIA_PACKET_TYPES.includes(packet.type)) {
			this.subscription.send(packet);
		}
	}

	public cancel(): void {
		this.subscription.cancel();
		this.connection.removeListener(this.incomingPacketListener);
	}
}

class MediaSyncServer {
	private readonly packetBus: PacketBus;

	constructor() {
		this.packetBus = new PacketBus();
	}

	public subscribeLocal(controller: MediaController): MediaSyncSubscription {
		return new LocalMediaSyncSubscription(
			this.packetBus.subscribe(),
			controller
		);
	}

	public subscribeRemote(connection: Connection): MediaSyncSubscription {
		return new RemoteMediaSyncSubscription(
			this.packetBus.subscribe(),
			connection
		);
	}
}

export { MediaSyncClient, MediaSyncServer, MediaSyncSubscription };
