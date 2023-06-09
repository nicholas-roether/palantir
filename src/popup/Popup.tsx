import { JSX, Show, createSignal } from "solid-js";
import { css } from "@emotion/css";
import { Heading } from "@nicholas-roether/palantir-ui-solid";
import { SessionStatus } from "../common/messages";
import { requestSessionStatusUpdate, sessionEvents } from "./handle-session";
import SessionCreationForm from "./components/SessionCreationForm";
import SessionDisplay from "./components/SessionDisplay";

const container = css`
	width: 400px;
	padding: 10px 20px;
`;

const contentWrapper = css`
	text-align: center;
	padding-bottom: 10px;
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
					<SessionDisplay status={session()!} />
				</Show>
			</div>
		</div>
	);
}

export default Popup;
