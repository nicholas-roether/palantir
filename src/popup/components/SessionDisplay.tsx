import { JSX, Show } from "solid-js";
import { SessionStatus, SessionType } from "../../common/messages";
import { Span } from "@nicholas-roether/palantir-ui-solid";
import { createInviteLink } from "../invite-link";
import CopyLinkButton from "./CopyLinkButton";
import UserList from "./UserList";
import { css } from "@emotion/css";
import PasswordDisplay from "./PasswordDisplay";
import { ClientIcon, HostIcon } from "../../common/components/icons";

interface SessionDisplayProps {
	status: SessionStatus;
}

const sessionDisplayWrapper = css`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
`;

const inviteArea = css`
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-bottom: 10px;
	width: 100%;
`;

function SessionDisplay(props: SessionDisplayProps): JSX.Element {
	function inviteLink(): string | null {
		if (!props.status.host) return null;
		return createInviteLink(props.status.host, props.status.hostId);
	}

	return (
		<div class={sessionDisplayWrapper}>
			<Show when={props.status.type == SessionType.HOST}>
				<Span>
					Currently <b>hosting</b> a session. <HostIcon />
				</Span>
			</Show>
			<Show when={props.status.type == SessionType.CLIENT}>
				<Span>
					Currently in a session. <ClientIcon />
				</Span>
			</Show>
			<Show when={inviteLink()}>
				<div class={inviteArea}>
					<CopyLinkButton href={inviteLink()!}>
						Copy invite link
					</CopyLinkButton>
					<PasswordDisplay password={props.status.accessToken} />
				</div>
			</Show>
			<UserList host={props.status.host} guests={props.status.guests} />
		</div>
	);
}

export default SessionDisplay;

export { SessionDisplayProps };
