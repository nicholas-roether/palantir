import ty, { checkType } from "lifeboat";
import {
	ConnectionState,
	SessionCloseReason,
	SessionStatus,
	SessionType,
	User,
	UserRole
} from "../common/messages";
import { ClientSessionAuth, HostSessionAuth } from "./auth";
import { Connection, Peer } from "./p2p";
import PacketType from "./packets";
import backgroundLogger from "./logger";

const sessionLogger = backgroundLogger.sub("session");

const sessionUpdatePacketSchema = ty.object({
	users: ty.array(
		ty.object({
			name: ty.string(),
			role: ty.enum(UserRole.GUEST, UserRole.HOST)
		})
	)
});

class SessionCloseEvent extends Event {
	public readonly reason: SessionCloseReason;

	constructor(reason: SessionCloseReason) {
		super("close");
		this.reason = reason;
	}
}

class SessionStatusUpdateEvent extends Event {
	public readonly status: SessionStatus;

	constructor(status: SessionStatus) {
		super("statusupdate");
		this.status = status;
	}
}

abstract class Session extends EventTarget {
	protected readonly peer: Peer;

	constructor() {
		super();
		this.peer = new Peer((conn) => this.handleConnection(conn));
	}

	public close(reason: SessionCloseReason): void {
		this.peer.close();
		this.dispatchEvent(new SessionCloseEvent(reason));
	}

	public abstract getStatus(): Promise<SessionStatus>;

	protected abstract handleConnection(connection: Connection): Promise<void>;

	protected async broadcastStatusUpdate(): Promise<void> {
		this.dispatchEvent(new SessionStatusUpdateEvent(await this.getStatus()));
	}
}

const CONNECTION_TIMEOUT = 5000; // ms

class ClientSession extends Session {
	public readonly username: string;
	public readonly hostId: string;
	private readonly auth: ClientSessionAuth;
	private connectionState = ConnectionState.CONNECTING;
	private users: User[];

	constructor(username: string, hostId: string, accessToken: string) {
		super();
		this.username = username;
		this.hostId = hostId;
		this.users = [{ role: UserRole.GUEST, name: this.username }];
		this.auth = new ClientSessionAuth(accessToken);
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

	protected async handleConnection(connection: Connection): Promise<void> {
		this.connectionState = ConnectionState.CONNECTED;
		if (!(await this.auth.authenticate(connection))) {
			this.close(SessionCloseReason.UNAUTHORIZED);
			return;
		}
		connection.addEventListener("close", () =>
			this.close(SessionCloseReason.DISCONNECTED)
		);

		await this.listen(connection);
	}

	private async listen(connection: Connection): Promise<void> {
		for await (const packet of connection.incoming) {
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
			this.users = packet.users;
		}
	}
}

class HostSession extends Session {
	public readonly username: string;
	private readonly auth: HostSessionAuth;
	private readonly connections: Set<Connection>;

	constructor(username: string) {
		super();
		this.auth = new HostSessionAuth();
		this.username = username;
		this.connections = new Set();
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
			users: []
		};
	}

	protected async handleConnection(connection: Connection): Promise<void> {
		if (!(await this.auth.checkAuth(connection))) {
			connection.close();
			return;
		}
		this.connections.add(connection);
		connection.addEventListener("close", () =>
			this.connections.delete(connection)
		);
	}
}

export {
	Session,
	ClientSession,
	HostSession,
	SessionCloseReason,
	SessionCloseEvent,
	SessionStatusUpdateEvent
};
