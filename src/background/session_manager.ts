import ty, { assertType } from "lifeboat";
import { SessionStatus } from "../common/messages";
import {
	ClientSession,
	HostSession,
	Session,
	SessionCloseEvent,
	SessionCloseReason,
	SessionStatusUpdateEvent
} from "./session";

class ManagedSessionCloseEvent extends Event {
	public readonly tabId: number;
	public readonly reason: SessionCloseReason;

	constructor(tabId: number, reason: SessionCloseReason) {
		super("close");
		this.tabId = tabId;
		this.reason = reason;
	}
}

class ManagedSessionStatusUpdateEvent extends Event {
	public readonly tabId: number;
	public readonly status: SessionStatus;

	constructor(tabId: number, status: SessionStatus) {
		super("statusupdate");
		this.tabId = tabId;
		this.status = status;
	}
}

class SessionManager extends EventTarget {
	private readonly tabIdSessionMap: Map<number, Session>;

	constructor() {
		super();
		this.tabIdSessionMap = new Map();
	}

	public async openClientSession(
		tabId: number,
		hostId: string,
		accessToken: string
	): Promise<ClientSession> {
		const session = new ClientSession(hostId, accessToken);
		await this.addSession(tabId, session);
		return session;
	}

	public async openHostSession(tabId: number): Promise<HostSession> {
		const session = new HostSession();
		await this.addSession(tabId, session);
		return session;
	}

	public getSession(tabId: number): Session | null {
		return this.tabIdSessionMap.get(tabId) ?? null;
	}

	public async closeSession(
		tabId: number,
		reason: SessionCloseReason
	): Promise<void> {
		const session = this.tabIdSessionMap.get(tabId);
		if (!session) return;
		await session.close(reason);
	}

	private async addSession(tabId: number, session: Session): Promise<void> {
		await this.closeSession(tabId, SessionCloseReason.SUPERSEDED);
		this.tabIdSessionMap.set(tabId, session);

		session.addEventListener("close", (evt) => {
			assertType(ty.instanceof(SessionCloseEvent), evt);
			this.tabIdSessionMap.delete(tabId);
			this.dispatchEvent(new ManagedSessionCloseEvent(tabId, evt.reason));
		});

		session.addEventListener("statusupdate", (evt) => {
			assertType(ty.instanceof(SessionStatusUpdateEvent), evt);
			this.broadcastSessionStatus(tabId, evt.status);
		});

		this.broadcastSessionStatus(tabId, await session.getStatus());
	}

	private broadcastSessionStatus(tabId: number, status: SessionStatus): void {
		this.dispatchEvent(new ManagedSessionStatusUpdateEvent(tabId, status));
	}
}

export default SessionManager;

export { ManagedSessionStatusUpdateEvent, ManagedSessionCloseEvent };
