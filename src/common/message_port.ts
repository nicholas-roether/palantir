import { Message } from "./messages";
import { EventEmitter } from "./typed_events";

type MessageHandler = (msg: Message) => void;

interface MessagePortAdapter {
	post(message: Message): void;
	listen(listener: MessageHandler): void;
	onClose(listener: () => void): void;
	close(): void;
}

class MessagePortBusAdapter implements MessagePortAdapter {
	private readonly listeners: MessageHandler[];

	constructor() {
		this.listeners = [];
	}

	public post(message: Message): void {
		browser.runtime.sendMessage(message);
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

	public post(message: Message): void {
		this.port.postMessage(message);
	}

	public listen(listener: MessageHandler): void {
		this.port.onMessage.addListener(listener as (message: object) => void);
	}

	public onClose(listener: () => void): void {
		this.port.onDisconnect.addListener(listener);
	}

	public close(): void {
		this.port.disconnect();
	}
}

class MessagePort extends EventEmitter<{ message: Message; close: void }> {
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

	public post(message: Message): void {
		this.adapter.post(message);
	}

	public close(): void {
		this.adapter.close();
		this.emit("close", undefined);
	}

	public static bus(): MessagePort {
		return new MessagePort(new MessagePortBusAdapter());
	}

	public static listen(
		name: string,
		handler: (port: MessagePort) => void
	): void {
		browser.runtime.onConnect.addListener((port) => {
			if (port.name !== name) return;
			handler(new MessagePort(new MessagePortConnectionAdapter(port)));
		});
	}

	public static connect(name: string): MessagePort {
		const port = browser.runtime.connect({ name });
		return new MessagePort(new MessagePortConnectionAdapter(port));
	}
}

export { MessagePort, MessageHandler };
