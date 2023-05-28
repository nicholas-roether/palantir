import { JSX, Match, Show, Switch, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { render } from "solid-js/web";
import { css } from "@emotion/css";
import {
	Heading,
	TextInput,
	Button,
	Paragraph,
	Span
} from "@nicholas-roether/palantir-ui-solid";
import { SessionStatus, SessionCloseReason } from "../common/messages";
import {
	sessionEvents,
	requestSessionStatusUpdate,
	createHostSession
} from "./handle-session";

import "@nicholas-roether/palantir-ui/styles.css";
import { SessionType } from "../common/messages";
import { createInviteLink } from "./invite-link";

interface SessionCreationFormState {
	username: string;
}

const sessionCreationForm = css`
	display: flex;
	flex-direction: column;
	gap: 20px;
	margin: auto;
	width: 80%;
`;

function SessionCreationForm(): JSX.Element {
	const [state, setState] = createStore<SessionCreationFormState>({
		username: ""
	});

	function onSubmit(evt: SubmitEvent): void {
		evt.preventDefault();
		if (state.username.length == 0) return;

		createHostSession(state.username);
	}

	return (
		<form class={sessionCreationForm} onSubmit={onSubmit}>
			<TextInput
				name="state"
				placeholder="Nickname"
				aria-label="Nickname"
				value={state.username}
				onChange={(evt) => setState({ username: evt.target.value })}
			/>
			<Button large smoldering type="submit">
				Host Session
			</Button>
		</form>
	);
}

interface CopyLinkProps {
	href: string;
	children: JSX.Element;
}

function CopyLinkButton({ href, children }: CopyLinkProps): JSX.Element {
	function onClick(evt: MouseEvent): void {
		evt.preventDefault();

		navigator.clipboard.writeText(href);
	}

	return <Button onClick={onClick}>{children}</Button>
}

interface SessionDisplayProps {
	status: SessionStatus;
}

function SessionDisplay({ status }: SessionDisplayProps): JSX.Element {
	const inviteLink = createInviteLink(status.username, status.hostId);

	return (
		<>
			<Show when={status.type == SessionType.HOST}>
				<Paragraph>
					Currently <b>hosting</b> a session.
				</Paragraph>
			</Show>
			<Show when={status.type == SessionType.CLIENT}>
				<Paragraph>Currently in a session.</Paragraph>
			</Show>
			<CopyLinkButton href={inviteLink}>Copy invite link</CopyLinkButton>
		</>
	);
}

const container = css`
	width: 400px;
	padding: 10px 0;
`;

const contentWrapper = css`
	padding: 0 10px 20px;
	text-align: center;
`;

function Popup(): JSX.Element {
	const [session, setSession] = createSignal<SessionStatus | null>(null);

	sessionEvents.on("statusupdate", (status) => setSession(status));
	requestSessionStatusUpdate();

	return (
		<div class={container}>
			<Heading size="1">Palantir</Heading>
			<div class={contentWrapper}>
				<Show when={session() == null}>
					<SessionCreationForm />
				</Show>
				<Show when={session() != null}>
					<SessionDisplay status={session() as SessionStatus} />
				</Show>
			</div>
		</div>
	);
}

const content = document.getElementById("content");
if (!content) throw new Error("Missing content element!");
render(Popup, content);
