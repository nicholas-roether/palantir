import { JSX, Show } from "solid-js";
import { SessionStatus, SessionType } from "../../common/messages";
import { Span } from "@nicholas-roether/palantir-ui-solid";
import { createInviteLink } from "../invite-link";
import CopyLinkButton from "./CopyLinkButton";
import UserList from "./UserList";
import { css } from "@emotion/css";
import PasswordDisplay from "./PasswordDisplay";

interface SessionDisplayProps {
	status: SessionStatus;
}

const sessionDisplayWrapper = css`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
`;

function SessionDisplay(props: SessionDisplayProps): JSX.Element {
	const inviteLink = (): string =>
		createInviteLink(props.status.username, props.status.hostId);

	return (
		<div class={sessionDisplayWrapper}>
			<Show when={props.status.type == SessionType.HOST}>
				<Span>Currently <b>hosting</b> a session.</Span>
			</Show>
			<Show when={props.status.type == SessionType.CLIENT}>
				<Span>Currently in a session.</Span>
			</Show>
			<PasswordDisplay password={props.status.accessToken} />
			<CopyLinkButton href={inviteLink()}>
				Copy invite link
			</CopyLinkButton>
			<UserList users={props.status.users} />
		</div>
	);
}

export default SessionDisplay;

export { SessionDisplayProps };
