import { Session } from ".";
import { ConnectionState, SessionType } from "../../common/messages";
import { HostSessionAuth } from "../auth";
import MediaSyncHost from "../media_sync/host";
import MediaSyncServer, { SyncSubscription } from "../media_sync/server";
import { Connection, Packet, Peer } from "../p2p";
import PacketType from "../packets";
import sessionLogger from "./logger";
import { notify } from "./notifications";

const log = sessionLogger.sub("host");

interface ConnectedUser {
	username: string;
	connection: Connection;
	syncSubscription: SyncSubscription | null;
}

class HostSessionHandler {
	private readonly session: Session;
	private readonly peer: Peer;
	private readonly username;
	private readonly auth: HostSessionAuth;
	private readonly syncServer: MediaSyncServer;
	private readonly syncHost: MediaSyncHost;
	private readonly connectedUsers: Set<ConnectedUser>;

	constructor(session: Session, username: string) {
		this.session = session;
		this.peer = new Peer((conn) => this.onConnection(conn));
		this.username = username;
		this.auth = new HostSessionAuth();
		this.syncServer = new MediaSyncServer();
		this.syncHost = this.syncServer.subscribeHost(this.session.tabId);
		this.connectedUsers = new Set();

		this.session.on("closed", () => this.stop());
		this.syncHost.on("close", (reason) => this.session.close(reason));
	}

	public async getId(): Promise<string> {
		return await this.peer.getId();
	}

	public get accessToken(): string {
		return this.auth.accessToken;
	}

	public start(): void {
		if (!this.session.isOpen()) return;

		notify("Hosting Palantir Session", "Session is now public");

		this.peer.listen();
		this.postStatusUpdate();
		this.syncHost.start();
		log.info(
			`Host session on tab ${this.session.tabId} is now listening for connections.`
		);
	}

	public stop(): void {
		this.peer.close();
		this.syncHost.stop();
	}

	private async onConnection(connection: Connection): Promise<void> {
		const authRes = await this.auth.checkAuth(connection);
		if (!authRes.success) {
			connection.close();
			return;
		}

		notify("User Joined", `${authRes.username} joined the session`);
		log.info(
			`User ${authRes.username} connected to host session on tab ${this.session.tabId}`
		);

		const user: ConnectedUser = {
			username: authRes.username,
			connection,
			syncSubscription: null
		};
		this.connectedUsers.add(user);
		await this.postStatusUpdate();
		this.sendSessionUpdate();

		connection.on("close", async () => {
			this.connectedUsers.delete(user);
			await this.postStatusUpdate();
			this.sendSessionUpdate();

			notify("User Left", `${authRes.username} left the session`);
			log.info(
				`User ${authRes.username} has disconnected from session on tab ${this.session.tabId}`
			);
		});

		connection.on("packet", (packet) => this.onPacket(packet, user));
	}

	private onPacket(packet: Packet, user: ConnectedUser): void {
		switch (packet.type) {
			case PacketType.START_MEDIA_SYNC:
				this.startMediaSync(user);
				break;
			case PacketType.STOP_MEDIA_SYNC:
				this.stopMediaSync(user);
		}
	}

	private startMediaSync(user: ConnectedUser): void {
		user.syncSubscription?.stop();
		this.syncHost.initConnection(user.connection);
		user.syncSubscription = this.syncServer.subscribeClient(
			user.connection
		);
	}

	private stopMediaSync(user: ConnectedUser): void {
		user.syncSubscription?.stop();
		user.syncSubscription = null;
	}

	private sendSessionUpdate(): void {
		log.debug(
			`Host session on tab ${this.session.tabId} is broadcasting a status update`
		);
		for (const connectedUser of this.connectedUsers) {
			connectedUser.connection.send({
				type: PacketType.SESSION_UPDATE,
				host: this.username,
				guests: this.getGuests()
			});
		}
	}

	private async postStatusUpdate(): Promise<void> {
		this.session.postStatusUpdate({
			type: SessionType.HOST,
			hostId: await this.getId(),
			host: this.username,
			accessToken: this.accessToken,
			connectionState: ConnectionState.CONNECTED,
			guests: this.getGuests()
		});
	}

	private getGuests(): string[] {
		const guests: string[] = [];
		for (const connectedUser of this.connectedUsers) {
			guests.push(connectedUser.username);
		}
		return guests;
	}
}

export { HostSessionHandler };
