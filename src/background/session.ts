import ty, { checkType } from "lifeboat";
import {
	ConnectionState,
	SessionCloseReason,
	SessionStatus,
	SessionType,
	User,
	UserRole,
	VideoSyncMessage
} from "../common/messages";
import { ClientSessionAuth, HostSessionAuth } from "./auth";
import { Connection, Peer } from "./p2p";
import PacketType from "./packets";
import backgroundLogger from "./logger";
import { EventEmitter } from "../common/typed_events";
import { VideoSyncClient, VideoSyncServer } from "./video_sync";

const sessionLogger = backgroundLogger.sub("session");

const sessionUpdatePacketSchema = ty.object({
	users: ty.array(
		ty.object({
			name: ty.string(),
			role: ty.enum(UserRole.GUEST, UserRole.HOST)
		})
	)
});

interface SessionCloseEvent {
	reason: SessionCloseReason;
}

interface SessionStatusUpdateEvent {
	status: SessionStatus;
}

interface SessionVideoSyncEvent {
	message: VideoSyncMessage
}

interface SessionEventMap {
	close: SessionCloseEvent;
	statusupdate: SessionStatusUpdateEvent;
	videosync: SessionVideoSyncEvent;
}

abstract class Session extends EventEmitter<SessionEventMap> {
	protected readonly peer: Peer;

	constructor() {
		super();
		this.peer = new Peer((conn) => this.handleConnection(conn));
	}

	public close(reason: SessionCloseReason): void {
		this.peer.close();
		this.emit("close", { reason });
	}

	public abstract getStatus(): Promise<SessionStatus>;

	public abstract sync(message: VideoSyncMessage): void;

	protected abstract handleConnection(connection: Connection): Promise<void>;

	protected async broadcastStatusUpdate(): Promise<void> {
		this.emit("statusupdate", { status: await this.getStatus()});
	}
}

const CONNECTION_TIMEOUT = 5000; // ms

class ClientSession extends Session {
	public readonly username: string;
	public readonly hostId: string;
	private readonly auth: ClientSessionAuth;
	private connectionState = ConnectionState.CONNECTING;
	private users: User[];
	private syncClient: VideoSyncClient | null = null;

	constructor(username: string, hostId: string, accessToken: string) {
		super();
		this.username = username;
		this.hostId = hostId;
		this.users = [{ role: UserRole.GUEST, name: this.username }];
		this.auth = new ClientSessionAuth(username, accessToken);
		this.peer.connectTo(hostId);

		setTimeout(() => {
			if (this.connectionState != ConnectionState.CONNECTED) {
				this.close(SessionCloseReason.TIMEOUT);
			}
		}, CONNECTION_TIMEOUT);
	}

	public async getStatus(): Promise<SessionStatus> {
		return {
			type: SessionType.CLIENT,
			hostId: this.hostId,
			accessToken: this.auth.accessToken,
			connectionState: this.connectionState,
			users: this.users
		};
	}

	public sync(message: VideoSyncMessage): void {
		this.syncClient?.send(message);
	}

	protected async handleConnection(connection: Connection): Promise<void> {
		if (this.connectionState != ConnectionState.CONNECTING) {
			sessionLogger.warn(
				`A connection with host ${connection.remoteId} was started on a client session that was not connecting!`
			);
			connection.close();
			return;
		}

		this.connectionState = ConnectionState.CONNECTED;
		this.broadcastStatusUpdate();

		if (!(await this.auth.authenticate(connection))) {
			this.close(SessionCloseReason.UNAUTHORIZED);
			return;
		}
		connection.on("close", () =>
			this.close(SessionCloseReason.DISCONNECTED)
		);

		this.syncClient = VideoSyncClient.remote(connection);
		this.syncClient.on("message", evt => this.emit("videosync", evt))

		await Promise.all([this.listen(connection), this.syncClient.listen()]);
		this.close(SessionCloseReason.DISCONNECTED);
	}

	public close(reason: SessionCloseReason): void {
		super.close(reason);
		this.connectionState = ConnectionState.DISCONNECTED;
	}

	private async listen(connection: Connection): Promise<void> {
		for await (const packet of connection.listen()) {
			if (packet.type != PacketType.SESSION_UPDATE) {
				sessionLogger.warn(
					`Client session received packet of unexpected type ${packet.type}`
				);
				continue;
			}
			if (!checkType(sessionUpdatePacketSchema, packet)) {
				sessionLogger.error(
					`Client session received malformed session update packet: ${sessionUpdatePacketSchema.reason}`
				);
				continue;
			}
			sessionLogger.debug(
				`Client session received a session status update`
			);
			this.users = packet.users;
		}
	}
}

interface ConnectedUser {
	username: string;
	connection: Connection;
}

class HostSession extends Session {
	public readonly username: string;
	private readonly auth: HostSessionAuth;
	private readonly connectedUsers: Set<ConnectedUser>;
	private readonly syncServer: VideoSyncServer;
	private readonly syncClient: VideoSyncClient;

	constructor(username: string) {
		super();
		this.auth = new HostSessionAuth();
		this.username = username;
		this.connectedUsers = new Set();
		this.syncServer = new VideoSyncServer();
		this.syncClient = this.syncServer.createLocalClient();
		this.syncClient.on("message", (evt) => this.emit("videosync", evt))
		this.peer.listen();
	}

	public async getId(): Promise<string> {
		return await this.peer.getId();
	}

	public get accessToken(): string {
		return this.auth.accessToken;
	}

	public async getStatus(): Promise<SessionStatus> {
		return {
			type: SessionType.HOST,
			hostId: await this.getId(),
			accessToken: this.auth.accessToken,
			connectionState: ConnectionState.CONNECTED,
			users: this.getUsers()
		};
	}

	public sync(message: VideoSyncMessage): void {
		this.syncClient.send(message);
	}

	protected async handleConnection(connection: Connection): Promise<void> {
		const res = await this.auth.checkAuth(connection);
		if (!res.success) {
			connection.close();
			return;
		}
		sessionLogger.info(
			`User ${
				res.username
			} connected to host session ${await this.getId()}`
		);

		const user: ConnectedUser = { username: res.username, connection };
		this.connectedUsers.add(user);
		await this.broadcastStatusUpdate();
		await this.sendSessionUpdatePackets();

		const syncConnId = this.syncServer.addRemote(connection);

		connection.on("close", async () => {
			this.connectedUsers.delete(user);
			this.syncServer.removeRemote(syncConnId);
			await this.broadcastStatusUpdate();
			await this.sendSessionUpdatePackets();

			sessionLogger.info(
				`User ${
					res.username
				} disconnected from host session ${await this.getId()}`
			);
		});
	}

	private async sendSessionUpdatePackets(): Promise<void> {
		sessionLogger.debug(
			`Host session ${await this.getId()} is broadcasting a session status update`
		);
		for (const connectedUser of this.connectedUsers) {
			connectedUser.connection.send({
				type: PacketType.SESSION_UPDATE,
				users: this.getUsers()
			});
		}
	}

	private getUsers(): User[] {
		const users: User[] = [{ role: UserRole.HOST, name: this.username }];
		for (const connectedUser of this.connectedUsers) {
			users.push({ role: UserRole.GUEST, name: connectedUser.username });
		}
		return users;
	}
}

export {
	Session,
	ClientSession,
	HostSession,
	SessionCloseReason,
	SessionCloseEvent,
	SessionStatusUpdateEvent,
	SessionVideoSyncEvent
};
