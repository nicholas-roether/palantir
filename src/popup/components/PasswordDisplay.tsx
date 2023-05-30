import { JSX, Show, createSignal } from "solid-js";
import { Card } from "@nicholas-roether/palantir-ui-solid";

interface PasswordDisplayProps {
	password: string;
}

function createPasswordMask(length: number): string {
	return "\u2022".repeat(length);
}

function displayPassword(password: string, visible: boolean): string {
	if (visible) return password;
	return createPasswordMask(password.length);
}

function PasswordDisplay(props: PasswordDisplayProps): JSX.Element {
	const [visible, setVisible] = createSignal(true);

	const pwdDisplay = (): string => displayPassword(props.password, visible());

	return (
		<Card onClick={() => setVisible((visible) => !visible)}>
			{pwdDisplay()} <Show when={visible()}>(click to hide)</Show>
			<Show when={!visible()}>(click to show)</Show>
		</Card>
	);
}

export default PasswordDisplay;
