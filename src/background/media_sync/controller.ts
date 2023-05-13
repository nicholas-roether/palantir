import { MessagePort } from "../../common/message_port";
import {
	MediaSyncAction,
	MediaSyncMessage,
	Message,
	MessageType,
	RequestMediaHeartbeatMessage
} from "../../common/messages";
import { EventEmitter } from "../../common/typed_events";
import mediaSyncLogger from "./logger";

const log = mediaSyncLogger.sub("controller");

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
		log.debug(`Playing video from ${time}`);

		this.playing = true;
		this.port.post(
			new MediaSyncMessage(
				MediaSyncAction.PLAY,
				this.getAdjustedTime(time, timestamp)
			)
		);
	}

	public pause(time: number): void {
		log.debug(`Pausing video at ${time}`);

		this.playing = false;
		this.port.post(new MediaSyncMessage(MediaSyncAction.PAUSE, time));
	}

	public sync(time: number, timestamp: number): void {
		const adjustedTime = this.playing
			? this.getAdjustedTime(time, timestamp)
			: time;

		log.debug(
			`Synchronizing video to time ${adjustedTime} (recieved: ${time})`
		);

		this.port.post(
			new MediaSyncMessage(MediaSyncAction.SYNC, adjustedTime)
		);
	}

	public requestHeartbeat(): void {
		log.debug("Requesting media heartbeat");

		this.port.post(new RequestMediaHeartbeatMessage());
	}

	private onMessage(msg: Message): void {
		if (msg.type != MessageType.MEDIA_SYNC) return;
		switch (msg.action) {
			case MediaSyncAction.PLAY:
				log.debug("Video played; broadcasting...");
				this.emit("play", {
					time: msg.time,
					timestamp: Date.now()
				});
				break;
			case MediaSyncAction.PAUSE:
				log.debug("Video paused; broadcasting...");
				this.emit("pause", {
					time: msg.time
				});
				break;
			case MediaSyncAction.SYNC:
				log.debug("Broadcasting new video time...");
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

export default MediaController;

export { MediaPlayEvent, MediaPauseEvent, MediaSyncEvent };
