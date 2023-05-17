import { MessagePort } from "../common/message_port";
import { MessageType } from "../common/messages";
import { Message } from "../common/messages";
import { MediaSyncMessage } from "../common/messages";

const HEARTBEAT_RATE = 1000; // ms

class MediaElementController {
	private readonly port: MessagePort;
	private readonly element: HTMLMediaElement;

	constructor(port: MessagePort, element: HTMLMediaElement) {
		this.port = port;
		this.element = element;
	}

	public start(): void {
		this.port.on("message", (msg) => this.onMessage(msg));
		this.element.addEventListener("play", () => this.sendUpdate());
		this.element.addEventListener("pause", () => this.sendUpdate());
		this.element.addEventListener("seeked", () => this.sendUpdate());
	}

	private startHeartbeat(): void {
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
		const adjustedTime = this.getAdjustedTime(message);
		message.playing
			? await this.element.play()
			: await this.element.pause();
		this.setTime(adjustedTime);
	}

	private sendUpdate(): void {
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
