import { createSignal } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { render } from "solid-js/web";
import { FindVideosMessage, Message, MessageType } from "./common/messages";

async function getCurrentTab(): Promise<number> {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const tabId = tabs[0].id;
	if (!tabId) throw new Error("No active tab id found!");
	return tabId;
}

function Popup(): JSX.Element {
	const [content, setContent] = createSignal("");

	browser.runtime.onMessage.addListener((message: Message) => {
		if (message.type == MessageType.VIDEO_FOUND) {
			setContent(
				(content) =>
					content +
					`\n${message.locations
						.map((l) => `${l.windowHref} :: ${l.query}`)
						.join("; ")}`
			);
		}
	});

	return (
		<>
			<button
				onClick={async () => {
					try {
						await browser.tabs.sendMessage(
							await getCurrentTab(),
							new FindVideosMessage()
						);
					} catch (err) {
						setContent((content) => content + `\nError: ${err}`);
					}
				}}
			>
				Find Videos
			</button>
			<p>{content()}</p>
		</>
	);
}

const content = document.getElementById("content");
if (!content) throw new Error("Missing content element!");
render(Popup, content);
