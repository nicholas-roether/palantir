import { messageBus } from "../common/message_port";
import { MediaFoundMessage } from "../common/messages";
import frameLogger from "./logger";
import { getQueryFor } from "./query";

const log = frameLogger.sub("discover");

function getMediaScore(element: HTMLMediaElement): number {
	const isVisible =
		element.checkVisibility?.({
			checkOpacity: true,
			checkVisibilityCSS: true
		}) ?? true;
	if (!isVisible) return 0;
	return element.offsetWidth * element.offsetHeight;
}

interface FoundMedia {
	query: string;
	score: number;
}

function findMedia(): FoundMedia[] {
	const videoElements = Array.from(document.getElementsByTagName("video"));
	return videoElements.map((elem) => ({
		query: getQueryFor(elem),
		score: getMediaScore(elem)
	}));
}

function discoverMedia(): void {
	for (const media of findMedia()) {
		log.debug(
			`Found a sync candiate at ${media.query} (score ${media.score}) in frame ${location.href}`
		);
		messageBus.post(
			new MediaFoundMessage(location.href, media.query, media.score)
		);
	}
}

export { discoverMedia };
