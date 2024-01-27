import { JSX, ParentProps, Show } from "solid-js";
import { SessionStatus, SessionType } from "../../common/messages";
import { Button, Span } from "@nicholas-roether/palantir-ui-solid";
import { createInviteLink } from "../invite-link";
import CopyLinkButton from "./CopyLinkButton";
import UserList from "./UserList";
import { css } from "@emotion/css";
import PasswordDisplay from "./PasswordDisplay";
import {
	ClientIcon,
	CloseIcon,
	HostIcon,
	LeaveIcon
} from "../../common/components/icons";

interface SessionDisplayProps {
	status: SessionStatus;
	onClose: () => void;
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

const fullWidth = css`
	width: 100%;
`;

const section = css`
	width: 100%;
	margin-bottom: 10px;
`;

function Section(props: ParentProps): JSX.Element {
	return <div class={section}>{props.children}</div>;
}

function SessionDisplay(props: SessionDisplayProps): JSX.Element {
	function inviteLink(): string | null {
		if (!props.status.host) return null;
		return createInviteLink(props.status.host, props.status.hostId);
	}

	return (
		<div class={sessionDisplayWrapper}>
			<Section>
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
			</Section>

			<Section>
				<Show when={inviteLink()}>
					<div class={inviteArea}>
						<CopyLinkButton href={inviteLink()!}>
							Copy invite link
						</CopyLinkButton>
						<PasswordDisplay password={props.status.passphrase} />
					</div>
				</Show>
			</Section>

			<Section>
				<UserList host={props.status.host} guests={props.status.guests} />
			</Section>

			<Section>
				<Button onClick={props.onClose} class={fullWidth}>
					<Show when={props.status.type == SessionType.HOST}>
						<CloseIcon /> Close session
					</Show>
					<Show when={props.status.type == SessionType.CLIENT}>
						<LeaveIcon /> Leave session
					</Show>
				</Button>
			</Section>
		</div>
	);
}

export default SessionDisplay;

export { SessionDisplayProps };
