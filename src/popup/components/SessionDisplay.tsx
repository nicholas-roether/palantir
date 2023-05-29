import { JSX, Show } from "solid-js";
import { Paragraph } from "@nicholas-roether/palantir-ui-solid";
import { SessionStatus, SessionType } from "../../common/messages";
import { createInviteLink } from "../invite-link";
import CopyLinkButton from "./CopyLinkButton";

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

export default SessionDisplay;

export { SessionDisplayProps };
