const enum MessageType {
	FIND_VIDEOS,
	VIDEO_FOUND,
	CREATE_SESSION,
	CLOSE_SESSION,
	GET_SESSION_STATUS,
	SESSION_STATUS_UPDATE
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

class CreateSessionMessage {
	public readonly type = MessageType.CREATE_SESSION;
	public readonly tabId: number;

	constructor(tabId: number) {
		this.tabId = tabId;
	}
}

class CloseSessionMessage {
	public readonly type = MessageType.CLOSE_SESSION;
	public readonly tabId: number;

	constructor(tabId: number) {
		this.tabId = tabId;
	}
}

class GetSessionStatusMessage {
	public readonly type = MessageType.GET_SESSION_STATUS;
	public readonly tabId: number;

	constructor(tabId: number) {
		this.tabId = tabId;
	}
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface SessionStatus {}

class SessionStatusUpdateMessage {
	public readonly type = MessageType.SESSION_STATUS_UPDATE;
	public readonly status: SessionStatus | null;

	constructor(status: SessionStatus | null) {
		this.status = status;
	}
}

type Message =
	| FindVideosMessage
	| VideosFoundMessage
	| CreateSessionMessage
	| CloseSessionMessage
	| GetSessionStatusMessage
	| SessionStatusUpdateMessage;

export {
	MessageType,
	Message,
	FindVideosMessage,
	ElementLocation,
	VideosFoundMessage,
	CreateSessionMessage,
	CloseSessionMessage,
	GetSessionStatusMessage,
	SessionStatus,
	SessionStatusUpdateMessage
};
