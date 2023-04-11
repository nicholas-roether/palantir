import {
	ElementLocation,
	Message,
	MessageType,
	VideosFoundMessage
} from "../common/messages";
import { getQueryFor } from "./query";

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

function onFindVideos() {
	const videoLocations = findVideos();
	browser.runtime.sendMessage(new VideosFoundMessage(videoLocations));
}

browser.runtime.onMessage.addListener((message: Message) => {
	if (message.type == MessageType.FIND_VIDEOS) {
		onFindVideos();
	}
});
