const enum MessageType {
	CREATE_HOST_SESSION,
	CREATE_CLIENT_SESSION,
	CLOSE_SESSION,
	GET_SESSION_STATUS,
	SESSION_STATUS_UPDATE,
	SESSION_CLOSED,
	MEDIA_SYNC,
	REQUEST_MEDIA_HEARTBEAT,
	CONNECT_MEDIA_ELEMENT,
	MEDIA_ELEMENT_CONNECTION_RESULT
}

class CreateHostSessionMessage {
	public readonly type = MessageType.CREATE_HOST_SESSION;
	public readonly tabId: number;
	public readonly username: string;

	constructor(tabId: number, username: string) {
		this.tabId = tabId;
		this.username = username;
	}
}

class CreateClientSessionMessage {
	public readonly type = MessageType.CREATE_CLIENT_SESSION;
	public readonly tabId: number;
	public readonly username: string;
	public readonly hostId: string;
	public readonly accessToken: string;

	constructor(
		tabId: number,
		username: string,
		hostId: string,
		accessToken: string
	) {
		this.tabId = tabId;
		this.username = username;
		this.hostId = hostId;
		this.accessToken = accessToken;
	}
}

class CloseSessionMessage {
	public readonly type = MessageType.CLOSE_SESSION;
	public readonly tabId: number;
	public readonly reason: SessionCloseReason;

	constructor(tabId: number, reason: SessionCloseReason) {
		this.tabId = tabId;
		this.reason = reason;
	}
}

class GetSessionStatusMessage {
	public readonly type = MessageType.GET_SESSION_STATUS;
	public readonly tabId: number;

	constructor(tabId: number) {
		this.tabId = tabId;
	}
}

const enum SessionType {
	HOST,
	CLIENT
}

const enum ConnectionState {
	DISCONNECTED,
	CONNECTING,
	CONNECTED
}

const enum UserRole {
	HOST,
	GUEST
}

interface User {
	name: string;
	role: UserRole;
}

interface SessionStatus {
	type: SessionType;
	hostId: string;
	accessToken: string;
	connectionState: ConnectionState;
	users: User[];
}

class SessionStatusUpdateMessage {
	public readonly type = MessageType.SESSION_STATUS_UPDATE;
	public readonly tabId: number;
	public readonly status: SessionStatus | null;

	constructor(tabId: number, status: SessionStatus | null) {
		this.tabId = tabId;
		this.status = status;
	}
}

const enum SessionCloseReason {
	UNKNOWN,
	UNAUTHORIZED,
	DISCONNECTED,
	SUPERSEDED,
	TAB_CLOSED,
	CLOSED_BY_USER,
	TIMEOUT
}

class SessionClosedMessage {
	public readonly type = MessageType.SESSION_CLOSED;
	public readonly tabId: number;
	public readonly reason: SessionCloseReason;

	constructor(tabId: number, reason: SessionCloseReason) {
		this.tabId = tabId;
		this.reason = reason;
	}
}

class MediaSyncMessage {
	public readonly type = MessageType.MEDIA_SYNC;
	public readonly playing: boolean;
	public readonly time: number;
	public readonly timestamp: number;

	constructor(playing: boolean, time: number, timestamp: number) {
		this.playing = playing;
		this.time = time;
		this.timestamp = timestamp;
	}
}

class RequestMediaHeartbeatMessage {
	public readonly type = MessageType.REQUEST_MEDIA_HEARTBEAT;
}

class ConnectMediaElementMessage {
	public readonly type = MessageType.CONNECT_MEDIA_ELEMENT;
	public readonly elementQuery: string;

	constructor(elementQuery: string) {
		this.elementQuery = elementQuery;
	}
}

class MediaElementConnectionResultMessage {
	public readonly type = MessageType.MEDIA_ELEMENT_CONNECTION_RESULT;
	public readonly connected: boolean;

	constructor(connected: boolean) {
		this.connected = connected;
	}
}

type Message =
	| CreateHostSessionMessage
	| CreateClientSessionMessage
	| CloseSessionMessage
	| GetSessionStatusMessage
	| SessionStatusUpdateMessage
	| SessionClosedMessage
	| MediaSyncMessage
	| RequestMediaHeartbeatMessage
	| ConnectMediaElementMessage
	| MediaElementConnectionResultMessage;

export {
	MessageType,
	Message,
	CreateHostSessionMessage,
	CreateClientSessionMessage,
	CloseSessionMessage,
	GetSessionStatusMessage,
	SessionType,
	ConnectionState,
	UserRole,
	User,
	SessionStatus,
	SessionStatusUpdateMessage,
	SessionCloseReason,
	SessionClosedMessage,
	MediaSyncMessage,
	RequestMediaHeartbeatMessage,
	ConnectMediaElementMessage,
	MediaElementConnectionResultMessage
};
