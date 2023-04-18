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
import { Connection, ConnectionEventType, Peer } from "./p2p";
import PacketType from "./packets";
import backgroundLogger from "./logger";
import {
	EventStream,
	EventStreamController,
	StreamEvent
} from "../common/events";

const sessionLogger = backgroundLogger.sub("session");

const sessionUpdatePacketSchema = ty.object({
	users: ty.array(
		ty.object({
			name: ty.string(),
			role: ty.enum(UserRole.GUEST, UserRole.HOST)
		})
	)
});

const enum SessionEventType {
	CLOSED,
	STATUS_UPDATE
}

class SessionCloseEvent implements StreamEvent<SessionEventType.CLOSED> {
	public readonly type = SessionEventType.CLOSED;
	public readonly reason: SessionCloseReason;

	constructor(reason: SessionCloseReason) {
		this.reason = reason;
	}
}

class SessionStatusUpdateEvent
	implements StreamEvent<SessionEventType.STATUS_UPDATE>
{
	public readonly type = SessionEventType.STATUS_UPDATE;
	public readonly status: SessionStatus;

	constructor(status: SessionStatus) {
		this.status = status;
	}
}

type SessionEvent = SessionCloseEvent | SessionStatusUpdateEvent;

abstract class Session {
	public readonly events: EventStream<SessionEventType, SessionEvent>;

	protected readonly peer: Peer;
	private readonly eventsController: EventStreamController<
		SessionEventType,
		SessionEvent
	>;

	constructor() {
		this.peer = new Peer((conn) => this.handleConnection(conn));
		this.eventsController = new EventStreamController();
		this.events = this.eventsController.createStream();
	}

	public close(reason: SessionCloseReason): void {
		this.peer.close();
		this.eventsController.emit(new SessionCloseEvent(reason));
	}

	public abstract getStatus(): Promise<SessionStatus>;

	protected abstract handleConnection(connection: Connection): Promise<void>;

	protected async broadcastStatusUpdate(): Promise<void> {
		this.eventsController.emit(
			new SessionStatusUpdateEvent(await this.getStatus())
		);
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

	protected async handleConnection(connection: Connection): Promise<void> {
		this.connectionState = ConnectionState.CONNECTED;
		this.broadcastStatusUpdate();

		if (!(await this.auth.authenticate(connection))) {
			this.close(SessionCloseReason.UNAUTHORIZED);
			return;
		}
		connection.events.on(ConnectionEventType.CLOSED, () =>
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

interface ConnectedUser {
	username: string;
	connection: Connection;
}

class HostSession extends Session {
	public readonly username: string;
	private readonly auth: HostSessionAuth;
	private readonly connectedUsers: Set<ConnectedUser>;

	constructor(username: string) {
		super();
		this.auth = new HostSessionAuth();
		this.username = username;
		this.connectedUsers = new Set();
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

	protected async handleConnection(connection: Connection): Promise<void> {
		const res = await this.auth.checkAuth(connection);
		if (!res.success) {
			connection.close();
			return;
		}

		const user: ConnectedUser = { username: res.username, connection };
		this.connectedUsers.add(user);
		await this.broadcastStatusUpdate();

		connection.events.on(ConnectionEventType.CLOSED, async () => {
			this.connectedUsers.delete(user);
			await this.broadcastStatusUpdate();
		});
	}

	protected async broadcastStatusUpdate(): Promise<void> {
		await super.broadcastStatusUpdate();
		for (const connectedUser of this.connectedUsers) {
			connectedUser.connection.outgoing.send({
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
	SessionEventType,
	SessionCloseEvent,
	SessionStatusUpdateEvent
};
