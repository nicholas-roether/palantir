import baseLogger from "./logger";
import { Message } from "./messages";
import { EventEmitter } from "./event_emitter";

const log = baseLogger.sub("messagePort");

type MessageHandler = (msg: Message) => void;

interface MessagePortAdapter {
	post(message: Message): Promise<void>;
	listen(listener: MessageHandler): void;
	onClose(listener: () => void): void;
	close(): void;
}

class MessagePortBusAdapter implements MessagePortAdapter {
	private readonly listeners: MessageHandler[];

	constructor() {
		this.listeners = [];
	}

	public async post(message: Message): Promise<void> {
		await browser.runtime.sendMessage(message);
	}

	public listen(listener: MessageHandler): void {
		this.listeners.push(listener);
		browser.runtime.onMessage.addListener(listener);
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
			listener(msg as Message);
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

class MessagePort extends EventEmitter<{ message: Message; close: void }> {
	private static messageBus: MessagePort | null = null;
	private readonly adapter: MessagePortAdapter;

	private constructor(adapter: MessagePortAdapter) {
		super();
		this.adapter = adapter;
		this.adapter.listen((msg) => {
			this.emit("message", msg);
		});
		this.adapter.onClose(() => {
			this.emit("close", undefined);
		});
	}

	public async post(message: Message): Promise<void> {
		try {
			await this.adapter.post(message);
		} catch (e) {
			log.warn("MessagePort disconnected due to post error");
			this.close();
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

export { MessagePort, MessageHandler };
