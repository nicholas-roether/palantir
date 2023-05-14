import { Connection, Packet } from "../p2p";
import { PacketBus, PacketBusSubscription } from "../packet_bus";
import PacketType from "../packets";
import MediaController from "./controller";
import mediaSyncLogger from "./logger";

const log = mediaSyncLogger.sub("server");

interface MediaSyncSubscription {
	cancel(): void;
}

class LocalMediaSyncSubscription implements MediaSyncSubscription {
	private readonly subscription: PacketBusSubscription;
	private readonly controller: MediaController;

	constructor(
		subscription: PacketBusSubscription,
		controller: MediaController
	) {
		this.subscription = subscription;
		this.controller = controller;
		this.subscription.on("packet", (packet) =>
			this.controller.handle(packet)
		);
		this.controller.on("packet", (packet) =>
			this.subscription.send(packet)
		);
	}

	public cancel(): void {
		log.info("Cancelling local sync subscription");

		this.subscription.cancel();
		this.controller.stop();
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
		if (packet.type == PacketType.SYNC_MEDIA) {
			this.subscription.send(packet);
		}
	}

	public cancel(): void {
		log.info(
			`Cancelling remote sync subscription for ${this.connection.remoteId}`
		);

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
		log.info("Adding local sync subscription");

		return new LocalMediaSyncSubscription(
			this.packetBus.subscribe(),
			controller
		);
	}

	public subscribeRemote(connection: Connection): MediaSyncSubscription {
		log.info(`Adding remote sync subscription for ${connection.remoteId}`);

		return new RemoteMediaSyncSubscription(
			this.packetBus.subscribe(),
			connection
		);
	}
}

export default MediaSyncServer;

export { MediaSyncSubscription };
