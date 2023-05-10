import ty from "lifeboat";
import {
	SessionCloseReason,
	SessionStatus,
	SessionStatusUpdateMessage,
	UserRole
} from "../../common/messages";
import { EventEmitter } from "../../common/typed_events";
import { MessagePort, messageBus } from "../../common/message_port";
import sessionLogger from "./logger";

const sessionUpdatePacketSchema = ty.object({
	users: ty.array(
		ty.object({
			name: ty.string(),
			role: ty.enum(UserRole.GUEST, UserRole.HOST)
		})
	)
});

class Session extends EventEmitter<{ closed: SessionCloseReason }> {
	public readonly tabId: number;
	private readonly tab: browser.tabs.Tab;
	private isOpen = true;
	private status: SessionStatus | null = null;

	constructor(tab: browser.tabs.Tab) {
		super();
		this.tab = tab;

		if (!this.tab.id) {
			throw new Error("Cannot open a session on a tab without a tabId");
		}
		this.tabId = this.tab.id;

		browser.tabs.onRemoved.addListener((tabId) => {
			if (tabId == this.tab.id) this.close(SessionCloseReason.TAB_CLOSED);
		});
	}

	public openPort(href: string): MessagePort {
		const name = `tab${this.tabId}/${encodeURIComponent(href)}`;
		return MessagePort.connect(name);
	}

	public close(reason: SessionCloseReason): void {
		if (!this.isOpen) return;
		this.isOpen = false;
		this.status = null;
		this.emit("closed", reason);
		this.broadcastStatus();
	}

	public broadcastStatus(): void {
		messageBus.post(
			new SessionStatusUpdateMessage(this.tabId, this.status)
		);
	}

	public postStatusUpdate(status: SessionStatus): void {
		if (!this.isOpen) return;
		this.status = status;
		this.broadcastStatus();
	}
}

export { sessionUpdatePacketSchema, Session, sessionLogger };
