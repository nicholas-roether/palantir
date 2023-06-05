import { MessagePort } from "../common/message_port";
import { MessageType } from "../common/messages";
import { Message } from "../common/messages";
import { MediaSyncMessage } from "../common/messages";
import frameLogger from "./logger";

const log = frameLogger.sub("controller");

const HEARTBEAT_RATE = 1000; // ms
const TOLERANCE = 200; // ms

class MediaElementController {
	private readonly port: MessagePort;
	private readonly element: HTMLMediaElement;
	private running = false;

	constructor(port: MessagePort, element: HTMLMediaElement) {
		this.port = port;
		this.element = element;
	}

	public start(): void {
		this.port.on("message", ({ message }) => this.onMessage(message));
		this.element.addEventListener("play", () => this.sendUpdate());
		this.element.addEventListener("pause", () => this.sendUpdate());
		this.element.addEventListener("seeked", () => this.sendUpdate());
		this.running = true;

		log.info("Media controller started");
	}

	public stop(): void {
		this.running = false;

		log.info("Media controller stopped");
	}

	private startHeartbeat(): void {
		log.info("Starting media heartbeat...");

		setInterval(() => this.sendUpdate(), HEARTBEAT_RATE);
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

		const adjustedTime = this.getAdjustedTime(message);
		message.playing ? await this.element.play() : this.element.pause();
		this.setTime(adjustedTime);
	}

	private sendUpdate(): void {
		if (!this.running) return;

		log.debug("Playback state updated");
		this.port.post(
			new MediaSyncMessage(
				!this.element.paused,
				this.getTime(),
				Date.now()
			)
		);
	}

	private getTime(): number {
		const timeSeconds = this.element.currentTime;
		return Math.round(timeSeconds * 1000);
	}

	private setTime(time: number): void {
		const difference = Math.abs(time - this.getTime());
		if (difference < TOLERANCE) return;

		const timeSeconds = time / 1000;
		this.element.currentTime = timeSeconds;
	}

	private getAdjustedTime(message: MediaSyncMessage): number {
		if (!message.playing) return message.time;

		const travelTime = Date.now() - message.timestamp;
		return message.time + travelTime;
	}
}

export default MediaElementController;
