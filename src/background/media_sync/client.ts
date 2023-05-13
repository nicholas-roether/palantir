import { Connection } from "../p2p";
import MediaController from "./controller";
import MediaSyncPacketHandler from "./packet_handler";

class MediaSyncClient {
	private readonly connection: Connection;
	private readonly handler: MediaSyncPacketHandler;
	private packetListener?: number;

	constructor(connection: Connection, controller: MediaController) {
		this.connection = connection;
		this.handler = new MediaSyncPacketHandler(controller);
	}

	public listen(): void {
		this.handler.on("packet", (packet) => this.connection.send(packet));
		this.packetListener = this.connection.on("packet", (packet) =>
			this.handler.handle(packet)
		);
	}

	public stop(): void {
		this.handler.stop();
		if (this.packetListener) {
			this.connection.removeListener(this.packetListener);
		}
	}
}

export default MediaSyncClient;
