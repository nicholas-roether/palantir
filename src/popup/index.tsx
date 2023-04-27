import { Match, Switch, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { JSX } from "solid-js/jsx-runtime";
import { render } from "solid-js/web";
import { styled } from "solid-styled-components";
import {
	CloseSessionMessage,
	CreateHostSessionMessage,
	CreateClientSessionMessage,
	GetSessionStatusMessage,
	Message,
	MessageType,
	SessionStatus,
	SessionCloseReason
} from "../common/messages";
import Eye from "../common/components/eye/Eye";

async function getCurrentTab(): Promise<number> {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const tabId = tabs[0].id;
	if (!tabId) throw new Error("No active tab id found!");
	return tabId;
}

async function createHostSession(): Promise<void> {
	await browser.runtime.sendMessage(
		new CreateHostSessionMessage(await getCurrentTab())
	);
}

async function createClientSession(
	hostId: string,
	accessToken: string
): Promise<void> {
	await browser.runtime.sendMessage(
		new CreateClientSessionMessage(await getCurrentTab(), hostId, accessToken)
	);
}

async function closeSession(reason: SessionCloseReason): Promise<void> {
	await browser.runtime.sendMessage(
		new CloseSessionMessage(await getCurrentTab(), reason)
	);
}

async function refreshSessionStatus(): Promise<void> {
	await browser.runtime.sendMessage(
		new GetSessionStatusMessage(await getCurrentTab())
	);
}

const PopupContainer = styled("div")`
	background-color: var(--color-background);
	padding: 1em;
`;

function HostSessionForm(): JSX.Element {
	return <button onClick={createHostSession}>Create Host session</button>;
}

interface ClientSessionFormFields {
	hostId: string;
	accessToken: string;
}

function ClientSessionForm(): JSX.Element {
	const [form, setForm] = createStore<ClientSessionFormFields>({
		hostId: "",
		accessToken: ""
	});

	return (
		<form>
			<input
				value={form.hostId}
				placeholder="Host ID"
				type="text"
				onChange={(e) => setForm("hostId", e.target.value)}
			/>
			<input
				value={form.accessToken}
				placeholder="AccessToken"
				type="text"
				onChange={(e) => setForm("accessToken", e.target.value)}
			/>
			<button
				onClick={() => createClientSession(form.hostId, form.accessToken)}
			>
				Create client session
			</button>
		</form>
	);
}

function Popup(): JSX.Element {
	const [session, setSession] = createSignal<SessionStatus | null>(null);

	browser.runtime.onMessage.addListener((message: Message) => {
		switch (message.type) {
			case MessageType.SESSION_STATUS_UPDATE:
				setSession(message.status);
				break;
			case MessageType.SESSION_CLOSED:
				setSession(null);
		}
	});

	refreshSessionStatus();

	return (
		<PopupContainer>
			<Eye size={200} />
			<Switch>
				<Match when={session() == null}>
					<h3>No active session</h3>
					<HostSessionForm />
					<br />
					<ClientSessionForm />
				</Match>
				<Match when={session()}>
					<h3>Session active!</h3>
					<code>{JSON.stringify(session(), undefined, 3)}</code>
					<button
						onClick={() => closeSession(SessionCloseReason.CLOSED_BY_USER)}
					>
						Exit session
					</button>
				</Match>
			</Switch>
		</PopupContainer>
	);
}

const content = document.getElementById("content");
if (!content) throw new Error("Missing content element!");
render(Popup, content);
