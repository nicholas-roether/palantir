const enum MessageType {
    FIND_VIDEOS,
    VIDEO_FOUND
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

type Message = FindVideosMessage | VideosFoundMessage;

export { MessageType, Message, FindVideosMessage, ElementLocation, VideosFoundMessage }