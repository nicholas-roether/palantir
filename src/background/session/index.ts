import ty from "lifeboat";
import {
	SessionCloseReason,
	SessionStatus,
	SessionStatusUpdateMessage
} from "../../common/messages";
import { EventEmitter } from "../../common/event_emitter";
import sessionLogger from "./logger";
import { MessagePort } from "../../common/message_port";
import { notify } from "./notifications";
import { describeSessionCloseReason } from "../../common/enum_descriptions";

const sessionUpdatePacketSchema = ty.object({
	host: ty.string(),
	guests: ty.array(ty.string())
});

class Session extends EventEmitter<{ closed: SessionCloseReason }> {
	public readonly tabId: number;
	private readonly tab: browser.tabs.Tab;
	private open = true;
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

	public close(reason: SessionCloseReason): void {
		if (!this.open) return;
		this.open = false;
		this.status = null;
		notify("Palantir Session Closed", describeSessionCloseReason(reason));
		this.emit("closed", reason);
		this.broadcastStatus();
	}

	public broadcastStatus(): void {
		MessagePort.bus.post(
			new SessionStatusUpdateMessage(this.tabId, this.status)
		);
	}

	public postStatusUpdate(status: SessionStatus): void {
		if (!this.open) return;
		this.status = status;
		this.broadcastStatus();
	}

	public isOpen(): boolean {
		return this.open;
	}
}

export { sessionUpdatePacketSchema, Session, sessionLogger };
