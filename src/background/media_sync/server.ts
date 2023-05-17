import { Connection, Packet } from "../p2p";
import { PacketBus, PacketBusSubscription } from "../packet_bus";
import PacketType from "../packets";
import MediaSyncHost from "./host";
import mediaSyncLogger from "./logger";

const log = mediaSyncLogger.sub("server");

interface SyncSubscription {
	cancel(): void;
}

class ClientSyncSubscription implements SyncSubscription {
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

	public subscribeHost(tabId: number): MediaSyncHost {
		log.info("Adding local sync subscription");

		return new MediaSyncHost(tabId, this.packetBus.subscribe());
	}

	public subscribeClient(connection: Connection): SyncSubscription {
		log.info(`Adding client sync subscription for ${connection.remoteId}`);

		return new ClientSyncSubscription(
			this.packetBus.subscribe(),
			connection
		);
	}
}

export default MediaSyncServer;

export { SyncSubscription };
