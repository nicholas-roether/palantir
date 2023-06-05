import { MessagePort } from "../../common/message_port";
import { MessageType, PollFrameReadyMessage } from "../../common/messages";
import sessionLogger from "./logger";

const CONTENT_POLLING_INTERVAL = 1000; // ms

function contentReady(tabId: number, frameHref: string): Promise<void> {
	const port = MessagePort.tab(tabId);
	if (!port) throw new Error(`Couldn't connect to tab ${tabId}`)
	return new Promise((res) => {
		const interval = setInterval(() => {
			sessionLogger.debug(`Polling for content readiness of ${frameHref}...`);
			port.post(new PollFrameReadyMessage(frameHref));
		}, CONTENT_POLLING_INTERVAL);

		const listener = MessagePort.bus.on("message", ({ message }) => {
			if (message.type == MessageType.FRAME_READY && message.href == frameHref) {
				MessagePort.bus.removeListener(listener);
				clearInterval(interval);
				sessionLogger.debug(`Content ${frameHref} is ready`);
				res();
			}
		});
	});
}

export { contentReady }
