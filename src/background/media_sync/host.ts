import { frameAddress } from "../../common/addresses";
import { MessagePort, messageBus } from "../../common/message_port";
import { DiscoverMediaMessage, MessageType } from "../../common/messages";
import { Connection, Packet } from "../p2p";
import { PacketBusSubscription } from "../packet_bus";
import PacketType from "../packets";
import MediaController from "./controller";
import mediaSyncLogger from "./logger";

const log = mediaSyncLogger.sub("host");

interface Media {
	frameHref: string;
	elementQuery: string;
}

interface MediaOption {
	media: Media;
	score: number;
}

const DISCOVERY_TIMEOUT = 100; // ms

class MediaSyncHost {
	private readonly tabId: number;
	private readonly subscription: PacketBusSubscription;
	private media: Media | null = null;
	private controller: MediaController | null = null;

	constructor(tabId: number, subscription: PacketBusSubscription) {
		this.tabId = tabId;
		this.subscription = subscription;
		this.subscription.on("packet", (packet) => this.onPacket(packet));
	}

	public async start(): Promise<void> {
		browser.tabs.onUpdated.addListener(async () => {
			await this.connectToFrame();
			await this.broadcastReinit();
		});

		await this.connectToFrame();

		log.info("Media sync host has started");
	}

	public stop(): void {
		this.subscription.cancel();

		log.info("Media sync host has stopped");
	}

	public async initConnection(connection: Connection): Promise<void> {
		const packet = await this.makeInitPacket();
		if (packet) connection.send(packet);
	}

	private onPacket(packet: Packet): void {
		this.controller?.handle(packet);
	}

	private async connectToFrame(): Promise<void> {
		const availableMedia = await this.discoverMedia();
		this.media = this.selectMedia(availableMedia);

		const addr = frameAddress(this.tabId, this.media.frameHref);
		const port = MessagePort.connect(addr);
		this.controller = new MediaController(port);
	}

	private async broadcastReinit(): Promise<void> {
		const initPacket = await this.makeInitPacket();
		if (initPacket) this.subscription.send(initPacket);
	}

	private async makeInitPacket(): Promise<Packet | null> {
		if (!this.media) return null;

		const tab = await browser.tabs.get(this.tabId);

		if (!tab) {
			log.error("Tab couldn't be found!");
			return null;
		}

		if (!tab.url) {
			throw new Error("Missing tab url, incorrect permissions?");
		}

		return {
			type: PacketType.MEDIA_SYNC_INIT,
			windowHref: tab.url,
			frameHref: this.media.frameHref,
			elementQuery: this.media.elementQuery
		};
	}

	private discoverMedia(): Promise<MediaOption[]> {
		const promise = new Promise<MediaOption[]>((res) => {
			const media: MediaOption[] = [];
			const listener = messageBus.on("message", (msg) => {
				if (msg.type != MessageType.MEDIA_FOUND) return;
				media.push({
					media: {
						frameHref: msg.frameHref,
						elementQuery: msg.elementQuery
					},
					score: msg.score
				});
			});
			setTimeout(() => {
				messageBus.removeListener(listener);
				res(media);
			}, DISCOVERY_TIMEOUT);
		});
		browser.tabs.sendMessage(this.tabId, new DiscoverMediaMessage());
		return promise;
	}

	private selectMedia(options: MediaOption[]): Media {
		let bestOption = options[0];
		for (let i = 1; i < options.length; i++) {
			if (options[i].score > bestOption.score) {
				bestOption = options[i];
			}
		}
		return bestOption.media;
	}
}

export default MediaSyncHost;
