const enum PeerConnectionState {
	CLOSED,
	CLOSING,
	CONNECTING,
	CONNECTED
}

class PeerConnectionStatusChangeEvent extends Event {
	public readonly state: PeerConnectionState;

	constructor(state: PeerConnectionState) {
		super("statuschange", {});
		this.state = state;
	}
}

class PeerConnection extends EventTarget {
	private static readonly CHANNEL_STATUS_CHANGE_EVENTS = [
		"close",
		"closing",
		"error"
	];

	private readonly localConnection: RTCPeerConnection;
	private readonly remoteConnection: RTCPeerConnection;
	private readonly sendChannel: RTCDataChannel;

	constructor() {
		super();

		this.localConnection = new RTCPeerConnection();
		this.remoteConnection = new RTCPeerConnection();

		this.sendChannel = this.localConnection.createDataChannel("sendChannel");
		this.sendChannel.addEventListener("open", () =>
			this.onSendChannelStatusChange()
		);
		this.sendChannel.addEventListener("close", () =>
			this.onSendChannelStatusChange()
		);
		for (const event in PeerConnection.CHANNEL_STATUS_CHANGE_EVENTS) {
			this.sendChannel.addEventListener(event, () =>
				this.onSendChannelStatusChange()
			);
		}
	}

	public get status(): PeerConnectionState {
		switch (this.sendChannel.readyState) {
			case "closed":
				return PeerConnectionState.CLOSED;
			case "closing":
				return PeerConnectionState.CLOSING;
			case "connecting":
				return PeerConnectionState.CONNECTING;
			case "open":
				return PeerConnectionState.CONNECTED;
		}
	}

	private onSendChannelStatusChange() {
		this.dispatchEvent(new PeerConnectionStatusChangeEvent(this.status));
	}
}
