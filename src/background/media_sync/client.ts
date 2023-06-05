import ty, { checkType } from "lifeboat";
import { Connection, Packet } from "../p2p";
import mediaSyncLogger from "./logger";
import PacketType from "../packets";
import { MessagePort } from "../../common/message_port";
import { ConnectMediaElementMessage, MessageType } from "../../common/messages";
import { promiseWithTimeout } from "../../common/utils";
import MediaController from "./controller";
import { frameAddress } from "../../common/addresses";
import { contentReady } from "../session/common";

const log = mediaSyncLogger.sub("client");

const mediaSyncInitPacketSchema = ty.object({
	windowHref: ty.string(),
	frameHref: ty.string(),
	elementQuery: ty.string()
});

const FRAME_RESPONSE_TIMEOUT = 6000; // ms

class MediaSyncClient {
	private readonly connection: Connection;
	private readonly tabId: number;
	private controller: MediaController | null = null;
	private packetListener?: number;

	constructor(connection: Connection, tabId: number) {
		this.connection = connection;
		this.tabId = tabId;
	}

	public start(): void {
		this.packetListener = this.connection.on("packet", (packet) =>
			this.onPacket(packet)
		);
		this.connection.send({ type: PacketType.START_MEDIA_SYNC });

		log.info(
			`Media sync client is listening on connection with ${this.connection.remoteId}`
		);
	}

	public stop(): void {
		this.controller?.stop();
		if (this.packetListener) {
			this.connection.removeListener(this.packetListener);
		}
		this.connection.send({ type: PacketType.STOP_MEDIA_SYNC });

		log.info(
			`Media sync client on connection with ${this.connection.remoteId} has stopped.`
		);
	}

	private onPacket(packet: Packet): void {
		switch (packet.type) {
			case PacketType.MEDIA_SYNC_INIT:
				this.onInitPacket(packet);
				break;
			default:
				this.controller?.handle(packet);
		}
	}

	private async onInitPacket(packet: Packet): Promise<void> {
		if (!checkType(mediaSyncInitPacketSchema, packet)) {
			log.error(
				`Recieved malformed media sync init packet: ${mediaSyncInitPacketSchema.reason}`
			);
			return;
		}

		await this.navigateTo(packet.windowHref);
		await contentReady(this.tabId, packet.frameHref);

		const port = MessagePort.connect(
			this.tabId,
			frameAddress(packet.frameHref)
		);
		if (!port) return;

		const success = await this.connectElement(port, packet.elementQuery);
		if (!success) return;

		const controller = new MediaController(port);
		this.controller?.stop();
		this.controller = controller;
	}

	private async navigateTo(href: string): Promise<void> {
		log.info(`Navigating to ${href}...`)
		const currentHref = await browser.tabs
			.get(this.tabId)
			.then((tab) => tab.url);
		if (!currentHref) throw new Error("Failed to look up url of tab!");

		if (currentHref != href) {
			await browser.tabs.update(this.tabId, { url: href });
		}
	}

	private async connectElement(
		port: MessagePort,
		elementQuery: string
	): Promise<boolean> {
		port.post(new ConnectMediaElementMessage(elementQuery));

		const response = await promiseWithTimeout(
			port.once("message"),
			null,
			FRAME_RESPONSE_TIMEOUT
		);
		if (!response) {
			log.error("Frame response timed out");
			return false;
		}

		const { message } = response;
		if (message.type != MessageType.MEDIA_ELEMENT_CONNECTION_RESULT) {
			log.error("Received invalid response from frame");
			return false;
		}
		if (!message.connected) {
			log.error("Connection with media element failed");
			return false;
		}

		return true;
	}
}

export default MediaSyncClient;
