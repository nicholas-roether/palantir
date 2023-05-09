import { Message, MessageType } from "../common/messages";

browser.runtime.onMessage.addListener((message: Message) => {
	if (message.type == MessageType.REDIRECT) {
		if (location.href != message.href) location.href = message.href;
	}
});
