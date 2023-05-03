import { Message, MessageType } from "../common/messages";

browser.runtime.onMessage.addListener((message: Message) => {
	if (message.type == MessageType.REDIRECT) {
		location.href = message.href;
	}
});
