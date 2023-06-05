import baseLogger from "./logger";
import { Message } from "./messages";
import { EventEmitter } from "./event_emitter";

const log = baseLogger.sub("messagePort");

const enum MessageSenderType {
	TAB,
	PORT,
	UNKNOWN
}

type MessageSender =
	| { type: MessageSenderType.TAB; tab: browser.tabs.Tab }
	| { type: MessageSenderType.PORT }
	| { type: MessageSenderType.UNKNOWN };

type MessageHandler = (msg: Message, sender: MessageSender) => void;

function mapMessageSender(
	nativeSender: browser.runtime.MessageSender
): MessageSender {
	if (nativeSender.tab) {
		return { type: MessageSenderType.TAB, tab: nativeSender.tab };
	}
	return { type: MessageSenderType.UNKNOWN };
}

type NativeMessageHandler = (
	msg: Message,
	sender: browser.runtime.MessageSender
) => boolean;

interface MessagePortAdapter {
	post(message: Message): Promise<void>;
	listen(listener: MessageHandler): void;
	onClose(listener: () => void): void;
	close(): void;
}

class MessagePortBusAdapter implements MessagePortAdapter {
	private readonly listeners: NativeMessageHandler[];

	constructor() {
		this.listeners = [];
	}

	public async post(message: Message): Promise<void> {
		await browser.runtime.sendMessage(message);
	}

	public listen(listener: MessageHandler): void {
		const handler: NativeMessageHandler = (msg, sender) => {
			listener(msg, mapMessageSender(sender));
			return false;
		};
		this.listeners.push(handler);
		browser.runtime.onMessage.addListener(handler);
	}

	public onClose(): void {
		// Nothing to do; the runtime event bus never closes
	}

	public close(): void {
		for (const listener of this.listeners) {
			browser.runtime.onMessage.removeListener(listener);
		}
	}
}

class MessagePortConnectionAdapter implements MessagePortAdapter {
	private readonly port: browser.runtime.Port;

	constructor(port: browser.runtime.Port) {
		this.port = port;
	}

	public async post(message: Message): Promise<void> {
		this.port.postMessage(message);
	}

	public listen(listener: MessageHandler): void {
		this.port.onMessage.addListener((msg) => {
			if (!("type" in msg)) return;
			listener(msg as Message, { type: MessageSenderType.PORT });
		});
	}

	public onClose(listener: () => void): void {
		this.port.onDisconnect.addListener(listener);
	}

	public close(): void {
		this.port.disconnect();
	}
}

class MessagePortTabAdapter implements MessagePortAdapter {
	private readonly tabId: number;

	constructor(tabId: number) {
		this.tabId = tabId;
	}

	public async post(message: Message): Promise<void> {
		await browser.tabs.sendMessage(this.tabId, message);
	}

	public listen(): void {
		// Nothing to do
	}

	public onClose(listener: () => void): void {
		browser.tabs.onRemoved.addListener((tabId) => {
			if (tabId == this.tabId) listener();
		});
	}

	public close(): void {
		// Nothing to do
	}
}

interface MessagePortMessageEvent {
	message: Message;
	sender: MessageSender;
}

class MessagePort extends EventEmitter<{
	message: MessagePortMessageEvent;
	close: void;
}> {
	private static messageBus: MessagePort | null = null;
	private readonly adapter: MessagePortAdapter;

	private constructor(adapter: MessagePortAdapter) {
		super();
		this.adapter = adapter;
		this.adapter.listen((message, sender) => {
			this.emit("message", { message, sender });
		});
		this.adapter.onClose(() => {
			this.emit("close", undefined);
		});
	}

	public async post(message: Message): Promise<void> {
		try {
			await this.adapter.post(message);
		} catch (e) {
			log.warn(`MessagePort encountered error while posting message: ${e}`);
		}
	}

	public close(): void {
		this.adapter.close();
		this.emit("close", undefined);
	}

	public static get bus(): MessagePort {
		if (!this.messageBus) {
			this.messageBus = new MessagePort(new MessagePortBusAdapter());
		}
		return this.messageBus;
	}

	public static listen(
		name: string,
		handler: (port: MessagePort) => void
	): void {
		log.debug(`Message port listener opened on "${name}"`);
		browser.runtime.onConnect.addListener((port) => {
			log.debug(`Received port connection to "${port}"`)
			if (port.name !== name) return;
			handler(new MessagePort(new MessagePortConnectionAdapter(port)));
		});
	}

	public static connect(tabId: number, name: string): MessagePort | null {
		log.debug(`Connecting to message port "${name}" on tab ${tabId}...`);
		const port = browser.tabs.connect(tabId, { name });
		return new MessagePort(new MessagePortConnectionAdapter(port));
	}

	public static tab(tabId: number): MessagePort | null {
		return new MessagePort(new MessagePortTabAdapter(tabId));
	}
}

export {
	MessagePort,
	MessageHandler,
	MessageSender,
	MessageSenderType,
	MessagePortMessageEvent
};
