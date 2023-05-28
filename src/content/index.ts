import { frameAddress } from "../common/addresses";
import { MessagePort, MessagePortMessageEvent } from "../common/message_port";
import {
	MediaElementConnectionResultMessage,
	MessageType
} from "../common/messages";
import MediaElementController from "./controller";
import { discoverMedia } from "./discover";
import frameLogger from "./logger";

const log = frameLogger;

function onBusMessage({ message }: MessagePortMessageEvent): void {
	if (message.type == MessageType.DISCOVER_MEDIA) discoverMedia();
}

async function handlePort(port: MessagePort): Promise<void> {
	log.debug("Message port connection opened");

	const { message } = await port.once("message");
	if (message.type != MessageType.CONNECT_MEDIA_ELEMENT) {
		log.error("Got unexpected message, expected CONNECT_MEDIA_ELEMENT");
		port.close();
		return;
	}

	log.debug("Media element connection message received");

	const element = document.querySelector(message.elementQuery);
	if (!element || !(element instanceof HTMLMediaElement)) {
		port.post(new MediaElementConnectionResultMessage(false));
		port.close();
		return;
	}

	log.debug("Media element connection successful, starting controller...");

	const controller = new MediaElementController(port, element);
	controller.start();
	port.on("close", () => controller.stop());

	port.post(new MediaElementConnectionResultMessage(true));
}

MessagePort.bus.on("message", onBusMessage);

MessagePort.listen(frameAddress(location.href), handlePort);
