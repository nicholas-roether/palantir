import { MessagePort } from "../common/message_port";
import { MessageType } from "../common/messages";
import { Message } from "../common/messages";
import { MediaSyncMessage } from "../common/messages";
import frameLogger from "./logger";

const log = frameLogger.sub("controller");

const HEARTBEAT_RATE = 1000; // ms
const TOLERANCE = 500; // ms

class MediaElementController {
	private readonly port: MessagePort;
	private readonly element: HTMLMediaElement;
	private lastUpdate: number;
	private seekPosition: number;
	private paused: boolean;
	private running = false;

	constructor(port: MessagePort, element: HTMLMediaElement) {
		this.port = port;
		this.element = element;
		this.lastUpdate = 0;
		this.seekPosition = 0;
		this.paused = true;
	}

	public start(): void {
		this.port.on("message", ({ message }) => this.onMessage(message));
		this.element.addEventListener("play", () => this.onPlay());
		this.element.addEventListener("pause", () => this.onPause());
		this.element.addEventListener("seeked", () => this.onSeek());
		this.running = true;

		log.info("Media controller started");
	}

	public stop(): void {
		this.running = false;

		log.info("Media controller stopped");
	}

	private startHeartbeat(): void {
		log.info("Starting media heartbeat...");

		setInterval(() => this.broadcastState(), HEARTBEAT_RATE);
	}

	private onMessage(message: Message): void {
		switch (message.type) {
			case MessageType.MEDIA_SYNC:
				this.onSyncMessage(message);
				break;
			case MessageType.REQUEST_MEDIA_HEARTBEAT:
				this.startHeartbeat();
		}
	}

	private async onSyncMessage(message: MediaSyncMessage): Promise<void> {
		log.debug(`Received sync message: ${JSON.stringify(message)}`);

		if (message.timestamp < this.lastUpdate) return;
		this.lastUpdate = message.timestamp;

		const adjustedTime = this.getAdjustedTime(message);
		message.playing ? this.play() : this.pause();
		this.setTime(adjustedTime);
	}

	private onPlay(): void {
		if (!this.paused) return;
		log.debug("Playback started by user.");
		this.paused = false;
		this.sendUpdate();
	}

	private onPause(): void {
		if (this.paused) return;
		log.debug("Playback paused by user.");
		this.paused = true;
		this.sendUpdate();
	}

	private onSeek(): void {
		if (this.isWithinTolerance(this.seekPosition)) return;
		this.seekPosition = this.getTime();
		log.debug(`User seeked to time ${this.seekPosition}ms.`);
		this.sendUpdate();
	}

	private sendUpdate(): void {
		log.debug("Playback state updated");
		this.lastUpdate = Date.now();
		this.broadcastState();
	}

	private broadcastState(): void {
		if (!this.running) return;

		log.debug(
			`Broadcasting playback state: playing=${!this.element
				.paused}, time=${this.getTime()} (updated ${this.lastUpdate})`
		);
		this.port.post(
			new MediaSyncMessage(
				!this.element.paused,
				this.getTime(),
				this.lastUpdate
			)
		);
	}

	private getTime(): number {
		const timeSeconds = this.element.currentTime;
		return Math.round(timeSeconds * 1000);
	}

	private setTime(time: number): void {
		if (this.isWithinTolerance(time)) return;

		log.debug(`Seeking to time ${time}ms.`);

		const timeSeconds = time / 1000;
		this.seekPosition = time;
		this.element.currentTime = timeSeconds;
	}

	private isWithinTolerance(time: number): boolean {
		const difference = Math.abs(time - this.getTime());
		return difference < TOLERANCE;
	}

	private play(): void {
		if (!this.element.paused) return;
		log.debug("Starting playback.");
		this.paused = false;
		this.element.play();
	}

	private pause(): void {
		if (this.element.paused) return;
		log.debug("Pausing playback.");
		this.paused = true;
		this.element.pause();
	}

	private getAdjustedTime(message: MediaSyncMessage): number {
		if (!message.playing) return message.time;

		const travelTime = Date.now() - message.timestamp;
		return message.time + travelTime;
	}
}

export default MediaElementController;
