import { Connection, Packet } from "../p2p";
import { PacketBus, PacketBusSubscription } from "../packet_bus";
import PacketType from "../packets";
import MediaController from "./controller";
import MediaSyncPacketHandler from "./packet_handler";

const MEDIA_PACKET_TYPES = [
	PacketType.PLAY_MEDIA,
	PacketType.PAUSE_MEDIA,
	PacketType.SYNC_MEDIA
];

interface MediaSyncSubscription {
	cancel(): void;
}

class LocalMediaSyncSubscription implements MediaSyncSubscription {
	private readonly subscription: PacketBusSubscription;
	private readonly handler: MediaSyncPacketHandler;

	constructor(
		subscription: PacketBusSubscription,
		controller: MediaController
	) {
		this.subscription = subscription;
		this.handler = new MediaSyncPacketHandler(controller);
		this.subscription.on("packet", (packet) => this.handler.handle(packet));
		this.handler.on("packet", (packet) => this.subscription.send(packet));
	}

	public cancel(): void {
		this.subscription.cancel();
		this.handler.stop();
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
		if (MEDIA_PACKET_TYPES.includes(packet.type)) {
			this.subscription.send(packet);
		}
	}

	public cancel(): void {
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
		return new LocalMediaSyncSubscription(
			this.packetBus.subscribe(),
			controller
		);
	}

	public subscribeRemote(connection: Connection): MediaSyncSubscription {
		return new RemoteMediaSyncSubscription(
			this.packetBus.subscribe(),
			connection
		);
	}
}

export default MediaSyncServer;

export { MediaSyncSubscription };
