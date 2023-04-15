import {
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

	public abstract getStatus(): SessionStatus;

	protected abstract handleConnection(connection: Connection): Promise<void>;

	protected broadcastStatusUpdate(): void {
		this.dispatchEvent(new SessionStatusUpdateEvent(this.getStatus()));
	}
}

class ClientSession extends Session {
	private readonly auth: ClientSessionAuth;

	constructor(hostId: string, accessToken: string) {
		super();
		this.auth = new ClientSessionAuth(accessToken);
		this.peer.connectTo(hostId);
	}

	public getStatus(): SessionStatus {
		return { type: SessionType.CLIENT };
	}

	protected async handleConnection(connection: Connection): Promise<void> {
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
	}

	public get id(): string {
		return this.peer.id;
	}

	public get accessToken(): string {
		return this.auth.accessToken;
	}

	public getStatus(): SessionStatus {
		return { type: SessionType.HOST };
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
