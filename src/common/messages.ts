const enum MessageType {
	CREATE_HOST_SESSION,
	CREATE_CLIENT_SESSION,
	CLOSE_SESSION,
	GET_SESSION_STATUS,
	SESSION_STATUS_UPDATE,
	SESSION_CLOSED,
	MEDIA_SYNC,
	REQUEST_MEDIA_HEARTBEAT
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

const enum MediaSyncAction {
	SYNC,
	PAUSE,
	PLAY
}

class MediaSyncMessage {
	public readonly type = MessageType.MEDIA_SYNC;
	public readonly action: MediaSyncAction;
	public readonly time: number;

	constructor(action: MediaSyncAction, time: number) {
		this.action = action;
		this.time = time;
	}
}

class RequestMediaHeartbeatMessage {
	public readonly type = MessageType.REQUEST_MEDIA_HEARTBEAT;
}

type Message =
	| CreateHostSessionMessage
	| CreateClientSessionMessage
	| CloseSessionMessage
	| GetSessionStatusMessage
	| SessionStatusUpdateMessage
	| SessionClosedMessage
	| MediaSyncMessage
	| RequestMediaHeartbeatMessage;

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
	MediaSyncAction,
	MediaSyncMessage,
	RequestMediaHeartbeatMessage
};
