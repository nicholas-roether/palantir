import { SessionStatus } from "../common/messages";
import {
	ClientSession,
	HostSession,
	Session,
	SessionCloseReason
} from "./session";
import backgroundLogger from "./logger";
import { describeSessionCloseReason } from "../common/enum_descriptions";
import { EventEmitter } from "../common/typed_events";

const sessionManagerLogger = backgroundLogger.sub("sessionmanager");

interface ManagedSessionCloseEvent {
	tabId: number;
	reason: SessionCloseReason;
}

interface ManagedSessionStatusUpdateEvent {
	tabId: number;
	status: SessionStatus;
}

interface SessionManagerEventMap {
	close: ManagedSessionCloseEvent;
	statusupdate: ManagedSessionStatusUpdateEvent;
}

class SessionManager extends EventEmitter<SessionManagerEventMap> {
	private readonly tabIdSessionMap: Map<number, Session>;

	constructor() {
		super();
		this.tabIdSessionMap = new Map();
	}

	public async openClientSession(
		tabId: number,
		username: string,
		hostId: string,
		accessToken: string
	): Promise<ClientSession> {
		const session = new ClientSession(username, hostId, accessToken);
		this.addSession(tabId, session);
		sessionManagerLogger.info(
			`Opened client session with host ${hostId} on tab ${tabId}`
		);
		return session;
	}

	public async openHostSession(
		tabId: number,
		username: string
	): Promise<HostSession> {
		const session = new HostSession(username);
		this.addSession(tabId, session);
		sessionManagerLogger.info(
			`Opened host session with id ${await session.getId()} on tab ${tabId}`
		);
		return session;
	}

	public getSession(tabId: number): Session | null {
		return this.tabIdSessionMap.get(tabId) ?? null;
	}

	public closeSession(tabId: number, reason: SessionCloseReason): void {
		const session = this.tabIdSessionMap.get(tabId);
		if (!session) return;
		session.close(reason);
	}

	private async addSession(tabId: number, session: Session): Promise<void> {
		this.closeSession(tabId, SessionCloseReason.SUPERSEDED);
		this.tabIdSessionMap.set(tabId, session);

		session.on("close", (evt) => {
			this.tabIdSessionMap.delete(tabId);
			this.emit("close", { tabId, reason: evt.reason });
			sessionManagerLogger.info(
				`Closed session on tab ${tabId}: ${describeSessionCloseReason(
					evt.reason
				)}`
			);
		});

		session.on("statusupdate", (evt) => {
			sessionManagerLogger.debug(
				`Status update for session on tab ${tabId}: ${JSON.stringify(
					evt.status
				)}`
			);
			this.broadcastSessionStatus(tabId, evt.status);
		});

		this.broadcastSessionStatus(tabId, await session.getStatus());
	}

	private broadcastSessionStatus(tabId: number, status: SessionStatus): void {
		this.emit("statusupdate", { tabId, status });
	}
}

export default SessionManager;

export { ManagedSessionStatusUpdateEvent, ManagedSessionCloseEvent };
