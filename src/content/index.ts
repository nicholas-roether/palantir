import {
	ElementLocation,
	Message,
	MessageType,
	StartVideoSyncMessage,
	VideoSyncMessage,
	VideosFoundMessage
} from "../common/messages";
import { getQueryFor } from "./query";
import { handleSyncMessage, startSync, stopSync } from "./video_sync";

function findVideos(): ElementLocation[] {
	const locations: ElementLocation[] = [];
	for (const elem of window.document.querySelectorAll("video")) {
		locations.push({
			windowHref: window.location.href,
			query: getQueryFor(elem)
		});
	}
	return locations;
}

function onFindVideos(): void {
	const videoLocations = findVideos();
	browser.runtime.sendMessage(new VideosFoundMessage(videoLocations));
}

function onVideoSync(message: VideoSyncMessage): void {
	handleSyncMessage(message);
}

function onStartVideoSync(message: StartVideoSyncMessage): void {
	const elem = document.querySelector(message.query);
	if (!elem || !(elem instanceof HTMLMediaElement)) return;

	startSync(elem, message.heartbeat);
}

function onStopVideoSync(): void {
	stopSync();
}

browser.runtime.onMessage.addListener((message: Message) => {
	switch (message.type) {
		case MessageType.FIND_VIDEOS:
			onFindVideos();
			break;
		case MessageType.VIDEO_SYNC:
			onVideoSync(message);
			break;
		case MessageType.START_VIDEO_SYNC:
			onStartVideoSync(message);
			break;
		case MessageType.STOP_VIDEO_SYNC:
			onStopVideoSync();
			break;
	}
});
