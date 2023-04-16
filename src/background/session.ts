import {
	ConnectionState,
	SessionCloseReason,
	SessionStatus,
	SessionType
} from "../common/messages";
import { ClientSessionAuth, HostSessionAuth } from "./auth";
import { Connection, Peer } from "./p2p";

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

	public async close(reason: SessionCloseReason): Promise<void> {
		await this.peer.close();
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
	public readonly hostId: string;
	private readonly auth: ClientSessionAuth;
	private connectionState = ConnectionState.CONNECTING;

	constructor(hostId: string, accessToken: string) {
		super();
		this.hostId = hostId;
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
			connectionState: this.connectionState
		};
	}

	protected async handleConnection(connection: Connection): Promise<void> {
		this.connectionState = ConnectionState.CONNECTED;
		if (!(await this.auth.authenticate(connection))) {
			await this.close(SessionCloseReason.UNAUTHORIZED);
			return;
		}
		connection.addEventListener("close", () =>
			this.close(SessionCloseReason.DISCONNECTED)
		);
	}
}

class HostSession extends Session {
	private readonly auth: HostSessionAuth;

	constructor() {
		super();
		this.auth = new HostSessionAuth();
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
			connectionState: ConnectionState.CONNECTED
		};
	}

	protected async handleConnection(connection: Connection): Promise<void> {
		if (!(await this.auth.checkAuth(connection))) {
			await connection.close();
			return;
		}
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
