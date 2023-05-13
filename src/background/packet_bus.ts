import { EventEmitter } from "../common/typed_events";
import { Packet } from "./p2p";

interface PacketBusEvent {
	sender: number;
	packet: Packet;
}

class PacketBusSubscription extends EventEmitter<{ packet: Packet }> {
	private readonly id: number;
	private readonly bus: PacketBus;
	private readonly listenerId: number;

	constructor(id: number, bus: PacketBus) {
		super();
		this.id = id;
		this.bus = bus;
		this.listenerId = bus.on("packet", (evt) => this.onPacket(evt));
	}

	public send(packet: Packet): void {
		this.bus.send(this.id, packet);
	}

	public cancel(): void {
		this.bus.removeListener(this.listenerId);
	}

	private onPacket({ sender, packet }: PacketBusEvent): void {
		if (sender == this.id) return;
		this.emit("packet", packet);
	}
}

class PacketBus extends EventEmitter<{ packet: PacketBusEvent }> {
	private nextSubscriptionId = 1;

	public send(sender: number, packet: Packet): void {
		this.emit("packet", { sender, packet });
	}

	public subscribe(): PacketBusSubscription {
		return new PacketBusSubscription(this.nextSubscriptionId++, this);
	}
}

export { PacketBus, PacketBusSubscription };
