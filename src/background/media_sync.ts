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

class MediaSyncClient extends EventEmitter<{ disconnect: void }> {
	private readonly connection: Connection;
	private readonly controller: MediaController;

	private listening = false;

	constructor(connection: Connection, controller: MediaController) {
		super();

		this.connection = connection;
		this.controller = controller;
	}

	public async listen(): Promise<void> {
		this.listening = true;

		this.controller.on("disconnect", () => this.onDisconnect());
		this.controller.on("play", (evt) => this.onPlayEvent(evt));
		this.controller.on("pause", (evt) => this.onPauseEvent(evt));
		this.controller.on("sync", (evt) => this.onSyncEvent(evt));

		for await (const packet of this.connection.listen()) {
			if (!this.listening) return;
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
	}

	private onDisconnect(): void {
		this.listening = false;
		this.emit("disconnect", undefined);
	}

	private onPlayEvent({ time, timestamp }: MediaPlayEvent): void {
		this.connection.send({ type: PacketType.PLAY_MEDIA, time, timestamp });
	}

	private onPauseEvent({ time }: MediaPauseEvent): void {
		this.connection.send({ type: PacketType.PAUSE_MEDIA, time });
	}

	private onSyncEvent({ time, timestamp }: MediaSyncEvent): void {
		this.connection.send({ type: PacketType.SYNC_MEDIA, time, timestamp });
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
