import { EventEmitter } from "../common/event_emitter";
import { MessagePort } from "../common/message_port";
import {
	CloseSessionMessage,
	CreateHostSessionMessage,
	GetSessionStatusMessage,
	SessionCloseReason,
	SessionStatus,
	MessageType,
	Message
} from "../common/messages";

async function getCurrentTab(): Promise<number | null> {
	const tabs = await browser.tabs.query({
		active: true,
		currentWindow: true
	});
	const tabId = tabs[0].id;
	return tabId ?? null;
}

async function createHostSession(username: string): Promise<boolean> {
	const tabId = await getCurrentTab();
	if (!tabId) return false;
	await MessagePort.bus.post(new CreateHostSessionMessage(tabId, username));
	return true;
}

async function closeSession(reason: SessionCloseReason): Promise<void> {
	const tabId = await getCurrentTab();
	if (!tabId) return;
	await MessagePort.bus.post(new CloseSessionMessage(tabId, reason));
}

async function requestSessionStatusUpdate(): Promise<void> {
	const tabId = await getCurrentTab();
	if (!tabId) return;
	await MessagePort.bus.post(new GetSessionStatusMessage(tabId));
}

class SessionEvents extends EventEmitter<{
	statusupdate: SessionStatus | null;
}> {
	constructor() {
		super();
		MessagePort.bus.on("message", ({ message }) =>
			this.handleMessage(message)
		);
	}

	private async handleMessage(msg: Message): Promise<void> {
		const tabId = await getCurrentTab();
		if (!tabId) return;

		switch (msg.type) {
			case MessageType.SESSION_STATUS_UPDATE:
				if (msg.tabId == tabId) this.emit("statusupdate", msg.status);
				break;
			case MessageType.SESSION_CLOSED:
				if (msg.tabId == tabId) this.emit("statusupdate", null);
		}
	}
}

const sessionEvents = new SessionEvents();

export {
	createHostSession,
	closeSession,
	requestSessionStatusUpdate,
	sessionEvents
};
