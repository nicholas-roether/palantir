const enum MessageType {
	FIND_VIDEOS,
	VIDEO_FOUND,
	CREATE_HOST_SESSION,
	CREATE_CLIENT_SESSION,
	CLOSE_SESSION,
	GET_SESSION_STATUS,
	SESSION_STATUS_UPDATE,
	SESSION_CLOSED
}

class FindVideosMessage {
	public readonly type = MessageType.FIND_VIDEOS;
}

interface ElementLocation {
	readonly windowHref: string;
	readonly query: string;
}

class VideosFoundMessage {
	public readonly type = MessageType.VIDEO_FOUND;
	public readonly locations: ElementLocation[];

	constructor(locations: ElementLocation[]) {
		this.locations = locations;
	}
}

class CreateHostSessionMessage {
	public readonly type = MessageType.CREATE_HOST_SESSION;
	public readonly tabId: number;

	constructor(tabId: number) {
		this.tabId = tabId;
	}
}

class CreateClientSessionMessage {
	public readonly type = MessageType.CREATE_CLIENT_SESSION;
	public readonly tabId: number;
	public readonly hostId: string;
	public readonly accessToken: string;

	constructor(tabId: number, hostId: string, accessToken: string) {
		this.tabId = tabId;
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

interface SessionStatus {
	type: SessionType;
	hostId: string;
	accessToken: string;
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
	CLOSED_BY_USER
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

type Message =
	| FindVideosMessage
	| VideosFoundMessage
	| CreateHostSessionMessage
	| CreateClientSessionMessage
	| CloseSessionMessage
	| GetSessionStatusMessage
	| SessionStatusUpdateMessage
	| SessionClosedMessage;

export {
	MessageType,
	Message,
	FindVideosMessage,
	ElementLocation,
	VideosFoundMessage,
	CreateHostSessionMessage,
	CreateClientSessionMessage,
	CloseSessionMessage,
	GetSessionStatusMessage,
	SessionType,
	SessionStatus,
	SessionStatusUpdateMessage,
	SessionCloseReason,
	SessionClosedMessage
};
