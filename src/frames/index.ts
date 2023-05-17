import { messageBus } from "../common/message_port";
import { Message, MessageType } from "../common/messages";
import { discoverMedia } from "./discover";

function onBusMessage(message: Message): void {
	if (message.type == MessageType.DISCOVER_MEDIA) discoverMedia();
}

messageBus.on("message", onBusMessage);
