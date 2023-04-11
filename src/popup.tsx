import { Match, Switch, createSignal } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { render } from "solid-js/web";
import {
	CloseSessionMessage,
	CreateSessionMessage,
	GetSessionStatusMessage,
	Message,
	MessageType,
	SessionStatus
} from "./common/messages";

async function getCurrentTab(): Promise<number> {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const tabId = tabs[0].id;
	if (!tabId) throw new Error("No active tab id found!");
	return tabId;
}

async function createSession() {
	await browser.runtime.sendMessage(
		new CreateSessionMessage(await getCurrentTab())
	);
}

async function closeSession() {
	await browser.runtime.sendMessage(
		new CloseSessionMessage(await getCurrentTab())
	);
}

async function refreshSessionStatus() {
	await browser.runtime.sendMessage(
		new GetSessionStatusMessage(await getCurrentTab())
	);
}

function Popup(): JSX.Element {
	const [session, setSession] = createSignal<SessionStatus | null>(null);

	browser.runtime.onMessage.addListener((message: Message) => {
		if (message.type == MessageType.SESSION_STATUS_UPDATE) {
			setSession(message.status);
		}
	});

	refreshSessionStatus();

	return (
		<Switch>
			<Match when={session() == null}>
				<h3>No active session</h3>
				<button onClick={createSession}>Create session</button>
			</Match>
			<Match when={session()}>
				<h3>Session active!</h3>
				<button onClick={closeSession}>Exit session</button>
			</Match>
		</Switch>
	);
}

const content = document.getElementById("content");
if (!content) throw new Error("Missing content element!");
render(Popup, content);
