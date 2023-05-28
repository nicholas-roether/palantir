import {
	CloseSessionMessage,
	CreateHostSessionMessage,
	GetSessionStatusMessage,
	Message,
	MessageType,
	SessionCloseReason
} from "../../common/messages";
import { CreateClientSessionMessage } from "../../common/messages";
import { describeSessionCloseReason } from "../../common/enum_descriptions";
import { Session, sessionLogger } from ".";
import { ClientSessionHandler } from "./client";
import { HostSessionHandler } from "./host";
import { MessagePort } from "../../common/message_port";

const log = sessionLogger.sub("server");

class SessionServer {
	private readonly sessions: Map<number, Session>;

	constructor() {
		this.sessions = new Map();
	}

	public start(): void {
		log.debug("Session server started.");
		MessagePort.bus.on("message", (msg) => this.onMessage(msg));
	}

	private async onMessage(msg: Message): Promise<void> {
		switch (msg.type) {
			case MessageType.CREATE_CLIENT_SESSION:
				await this.createClientSession(msg);
				break;
			case MessageType.CREATE_HOST_SESSION:
				await this.createHostSession(msg);
				break;
			case MessageType.GET_SESSION_STATUS:
				this.getSessionStatus(msg);
				break;
			case MessageType.CLOSE_SESSION:
				this.closeSession(msg);
		}
	}

	private async createClientSession({
		tabId,
		hostId,
		username,
		accessToken
	}: CreateClientSessionMessage): Promise<void> {
		log.info(
			`Starting client session with username "${username}" on tab ${tabId}...`
		);

		const sessionHandler = new ClientSessionHandler(
			await this.createSession(tabId),
			username,
			hostId,
			accessToken
		);

		sessionHandler.start();
	}

	private async createHostSession({
		tabId,
		username
	}: CreateHostSessionMessage): Promise<void> {
		log.info(
			`Starting host session with username "${username}" on tab ${tabId}...`
		);

		const sessionHandler = new HostSessionHandler(
			await this.createSession(tabId),
			username
		);
		sessionHandler.start();
	}

	private async createSession(tabId: number): Promise<Session> {
		const tab = await browser.tabs.get(tabId);
		const session = new Session(tab);
		const prevSession = this.sessions.get(tabId);
		if (prevSession) prevSession.close(SessionCloseReason.SUPERSEDED);

		this.sessions.set(tabId, session);
		return session;
	}

	private getSessionStatus({ tabId }: GetSessionStatusMessage): void {
		this.sessions.get(tabId)?.broadcastStatus();
	}

	private closeSession({ tabId, reason }: CloseSessionMessage): void {
		log.info(
			`Closing session on tab ${tabId} (${describeSessionCloseReason(
				reason
			)})`
		);
		this.sessions.get(tabId)?.close(reason);
	}
}

export { Session, SessionServer };
