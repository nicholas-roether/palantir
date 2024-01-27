import { ValidatedBy, checkType } from "lifeboat";
import {
	ConnectionState,
	SessionCloseReason,
	SessionType
} from "../../common/messages";
import { ClientSessionAuth } from "../auth";
import { Connection, Packet, Peer } from "../p2p";
import PacketType from "../packets";
import { Session } from "./server";
import { sessionLogger, sessionUpdatePacketSchema } from ".";
import MediaSyncClient from "../media_sync/client";
import { notify } from "./notifications";

const log = sessionLogger.sub("client");

class ClientSessionHandler {
	private static readonly CONNECTION_TIMEOUT = 5000; // ms

	private readonly session: Session;
	private readonly peer: Peer;
	private readonly username: string;
	private readonly hostId: string;
	private readonly auth: ClientSessionAuth;
	private syncClient: MediaSyncClient | null = null;

	private connectionState = ConnectionState.CONNECTING;
	private host?: string;
	private guests: string[];

	constructor(
		session: Session,
		username: string,
		hostId: string,
		accessToken: string
	) {
		this.session = session;
		this.username = username;
		this.hostId = hostId;
		this.guests = [this.username];
		this.auth = new ClientSessionAuth(username, accessToken);
		this.peer = new Peer((conn) => this.onConnection(conn));

		this.session.on("closed", () => this.stop());
	}

	public start(): void {
		if (!this.session.isOpen()) return;

		setTimeout(() => {
			if (this.connectionState != ConnectionState.CONNECTED) {
				this.session.close(SessionCloseReason.TIMEOUT);
			}
		}, ClientSessionHandler.CONNECTION_TIMEOUT);

		this.peer.connectTo(this.hostId);
		this.postStatusUpdate();
	}

	public stop(): void {
		this.connectionState = ConnectionState.DISCONNECTED;
		this.syncClient?.stop();
		this.peer.close();
	}

	private async onConnection(connection: Connection): Promise<void> {
		if (this.connectionState != ConnectionState.CONNECTING) {
			log.warn(
				`Ignoring incoming connection with ${connection.remoteId} on client session`
			);
			connection.close();
			return;
		}

		log.info(
			`Client session on tab ${this.session.tabId} established connection to host`
		);

		this.connectionState = ConnectionState.CONNECTED;
		this.postStatusUpdate();

		const authResult = await this.auth.authenticate(connection);
		if (!authResult) {
			log.warn(
				`Authorization of client session on tab ${this.session.tabId} failed!`
			);
			this.session.close(SessionCloseReason.UNAUTHORIZED);
			return;
		}

		connection.on("close", () => {
			log.warn(
				`Client session on tab ${this.session.tabId} lost connection!`
			);
			this.connectionState = ConnectionState.DISCONNECTED;
			this.session.close(SessionCloseReason.DISCONNECTED);
		});

		connection.on("packet", (packet) => this.onPacket(packet));

		this.syncClient = new MediaSyncClient(connection, this.session.tabId);
		this.syncClient.on("close", (reason) => this.session.close(reason));
		this.syncClient.start();
	}

	private onPacket(packet: Packet): void {
		log.debug(
			`Client session on tab ${
				this.session.tabId
			} recieved packet: ${JSON.stringify(packet)}`
		);
		if (packet.type != PacketType.SESSION_UPDATE) return;
		if (!checkType(sessionUpdatePacketSchema, packet)) {
			log.warn(
				`Client session on tab ${this.session.tabId} received a malformed session update packet: ${sessionUpdatePacketSchema.reason}`
			);
			return;
		}

		this.sendUpdateNotifications(packet);

		this.host = packet.host;
		this.guests = packet.guests;

		this.postStatusUpdate();
	}

	private sendUpdateNotifications(
		packet: ValidatedBy<typeof sessionUpdatePacketSchema>
	): void {
		const joined = new Set(packet.guests);
		const left = new Set(this.guests);
		for (const knownGuest of this.guests) joined.delete(knownGuest);
		for (const newGuest of packet.guests) left.delete(newGuest);

		for (const joinedGuest of joined) {
			notify("User Joined", `${joinedGuest} joined the session`);
		}
		for (const leftGuest of left) {
			notify("User Left", `${leftGuest} left the session`);
		}
	}

	private postStatusUpdate(): void {
		this.session.postStatusUpdate({
			type: SessionType.CLIENT,
			hostId: this.hostId,
			host: this.host,
			accessToken: this.auth.accessToken,
			connectionState: this.connectionState,
			guests: this.guests
		});
	}
}

export { ClientSessionHandler };
