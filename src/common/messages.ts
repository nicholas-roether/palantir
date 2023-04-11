const enum MessageType {
    FIND_VIDEOS,
    VIDEO_FOUND
}

class FindVideosMessage {
    public readonly type = MessageType.FIND_VIDEOS;
}

class VideosFoundMessage {
    public readonly type = MessageType.VIDEO_FOUND;
    public readonly queries: string[];

    constructor(queries: string[]) {
        this.queries = queries;
    }
}

type Message = FindVideosMessage | VideosFoundMessage;

export { MessageType, Message, FindVideosMessage, VideosFoundMessage }