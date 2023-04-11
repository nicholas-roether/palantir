import {
	SessionStatus,
	Message,
	MessageType,
	SessionStatusUpdateMessage
} from "../common/messages";

class Session {}

const sessions: Map<number, Session> = new Map();

function getSessionStatus(tabId: number): SessionStatus | null {
	const session = sessions.get(tabId);
	if (!session) return null;
	return {};
}

async function sendSessionStatusUpdate(tabId: number) {
	await browser.runtime.sendMessage(
		new SessionStatusUpdateMessage(getSessionStatus(tabId))
	);
}

function createSession(tabId: number) {
	sessions.set(tabId, new Session());
	sendSessionStatusUpdate(tabId);
}

function closeSession(tabId: number) {
	sessions.delete(tabId);
	sendSessionStatusUpdate(tabId);
}

browser.runtime.onMessage.addListener((message: Message) => {
	switch (message.type) {
		case MessageType.CREATE_SESSION:
			createSession(message.tabId);
			break;
		case MessageType.CLOSE_SESSION:
			closeSession(message.tabId);
			break;
		case MessageType.GET_SESSION_STATUS:
			sendSessionStatusUpdate(message.tabId);
	}
});

browser.tabs.onRemoved.addListener((tabId) => {
	sessions.delete(tabId);
});
