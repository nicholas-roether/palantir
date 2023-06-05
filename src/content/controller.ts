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
	private readonly ignoreNext: Set<string>;
	private lastUpdate = 0;
	private running = false;

	constructor(port: MessagePort, element: HTMLMediaElement) {
		this.port = port;
		this.element = element;
		this.ignoreNext = new Set();
	}

	public start(): void {
		this.port.on("message", ({ message }) => this.onMessage(message));
		this.element.addEventListener("play", () => this.sendUpdate("play"));
		this.element.addEventListener("pause", () => this.sendUpdate("pause"));
		this.element.addEventListener("seeked", () => this.sendUpdate("seeked"));
		this.running = true;

		log.info("Media controller started");
	}

	public stop(): void {
		this.running = false;

		log.info("Media controller stopped");
	}	

	private startHeartbeat(): void {
		log.info("Starting media heartbeat...");

		setInterval(() => this.sendUpdate("heartbeat"), HEARTBEAT_RATE);
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

	private sendUpdate(cause: string): void {
		if (!this.running) return;

		if (this.ignoreNext.has(cause)) {
			this.ignoreNext.delete(cause);
			return;
		}

		log.debug("Playback state updated");
		this.lastUpdate = Date.now();
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
		this.ignoreNext.add("seeked");
		this.element.currentTime = timeSeconds;
	}

	private play(): void {
		if (!this.element.paused) return;

		this.ignoreNext.add("play");
		this.element.play();
	}

	private pause(): void {
		if (this.element.paused) return;

		this.ignoreNext.add("pause");
		this.element.pause();
	}

	private getAdjustedTime(message: MediaSyncMessage): number {
		if (!message.playing) return message.time;

		const travelTime = Date.now() - message.timestamp;
		return message.time + travelTime;
	}
}

export default MediaElementController;
