import { SessionStatus } from "../common/messages";
import {
	ClientSession,
	HostSession,
	Session,
	SessionCloseReason,
	SessionEventType
} from "./session";
import backgroundLogger from "./logger";
import { describeSessionCloseReason } from "../common/enum_descriptions";
import {
	EventStream,
	EventStreamController,
	StreamEvent
} from "../common/events";

const sessionManagerLogger = backgroundLogger.sub("sessionmanager");

class ManagedSessionCloseEvent implements StreamEvent<SessionEventType.CLOSED> {
	public readonly type = SessionEventType.CLOSED;
	public readonly tabId: number;
	public readonly reason: SessionCloseReason;

	constructor(tabId: number, reason: SessionCloseReason) {
		this.tabId = tabId;
		this.reason = reason;
	}
}

class ManagedSessionStatusUpdateEvent
	implements StreamEvent<SessionEventType.STATUS_UPDATE>
{
	public readonly type = SessionEventType.STATUS_UPDATE;
	public readonly tabId: number;
	public readonly status: SessionStatus;

	constructor(tabId: number, status: SessionStatus) {
		this.tabId = tabId;
		this.status = status;
	}
}

type SessionManagerEvent =
	| ManagedSessionCloseEvent
	| ManagedSessionStatusUpdateEvent;

class SessionManager {
	public readonly events: EventStream<SessionEventType, SessionManagerEvent>;

	private readonly tabIdSessionMap: Map<number, Session>;
	private readonly eventsController: EventStreamController<
		SessionEventType,
		SessionManagerEvent
	>;

	constructor() {
		this.tabIdSessionMap = new Map();
		this.eventsController = new EventStreamController();
		this.events = this.eventsController.createStream();
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

		session.events.on(SessionEventType.CLOSED, (evt) => {
			this.tabIdSessionMap.delete(tabId);
			this.eventsController.emit(
				new ManagedSessionCloseEvent(tabId, evt.reason)
			);
			sessionManagerLogger.info(
				`Closed session on tab ${tabId}: ${describeSessionCloseReason(
					evt.reason
				)}`
			);
		});

		session.events.on(SessionEventType.STATUS_UPDATE, (evt) => {
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
		this.eventsController.emit(
			new ManagedSessionStatusUpdateEvent(tabId, status)
		);
	}
}

export default SessionManager;

export { ManagedSessionStatusUpdateEvent, ManagedSessionCloseEvent };
