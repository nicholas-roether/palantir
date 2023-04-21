import {
	SessionStatus,
	Message,
	MessageType,
	SessionStatusUpdateMessage,
	SessionCloseReason,
	SessionClosedMessage
} from "../common/messages";
import SessionManager from "./session_manager";

const sessionManager = new SessionManager();

sessionManager.on("statusupdate", (evt) => {
	sendSessionStatusUpdate(evt.tabId, evt.status);
});

sessionManager.on("close", (evt) => {
	sendSessionClosed(evt.tabId, evt.reason);
});

async function getSessionStatus(tabId: number): Promise<SessionStatus | null> {
	return (await sessionManager.getSession(tabId)?.getStatus()) ?? null;
}

async function sendSessionStatusUpdate(
	tabId: number,
	status: SessionStatus | null
): Promise<void> {
	await browser.runtime.sendMessage(
		new SessionStatusUpdateMessage(tabId, status)
	);
}

async function sendSessionClosed(
	tabId: number,
	reason: SessionCloseReason
): Promise<void> {
	await browser.runtime.sendMessage(new SessionClosedMessage(tabId, reason));
}

// TODO pass through message
const TEST_USER = "Test User";

browser.runtime.onMessage.addListener(async (message: Message) => {
	switch (message.type) {
		case MessageType.CREATE_HOST_SESSION:
			sessionManager.openHostSession(message.tabId, TEST_USER);
			break;
		case MessageType.CREATE_CLIENT_SESSION:
			sessionManager.openClientSession(
				message.tabId,
				TEST_USER,
				message.hostId,
				message.accessToken
			);
			break;
		case MessageType.CLOSE_SESSION:
			sessionManager.closeSession(message.tabId, message.reason);
			break;
		case MessageType.GET_SESSION_STATUS:
			sendSessionStatusUpdate(
				message.tabId,
				await getSessionStatus(message.tabId)
			);
	}
});

browser.tabs.onRemoved.addListener((tabId) => {
	sessionManager.closeSession(tabId, SessionCloseReason.TAB_CLOSED);
});
