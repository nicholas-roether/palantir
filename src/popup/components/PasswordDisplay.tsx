import { JSX, Show, createSignal } from "solid-js";
import { css } from "@emotion/css";

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

const passwordDisplay = css`
	display: flex;
`;

const passwordText = css`
	flex: 1;
	border: 3px transparent solid;
	background-color: var(--pui-color-background);
`;

const passwordVisibleButton = css`
	width: 3em;
	border: none;
	background-color: transparent;
`;

function PasswordDisplay(props: PasswordDisplayProps): JSX.Element {
	const [visible, setVisible] = createSignal(false);

	const pwdDisplay = (): string => displayPassword(props.password, visible());
	const buttonLabel = (): string =>
		visible() ? "Hide password" : "Show password";

	return (
		<div classList={{ "pui-surface": true, [passwordDisplay]: true }}>
			<span class={passwordText}>{pwdDisplay()}</span>
			<button
				class={passwordVisibleButton}
				onClick={() => setVisible((visible) => !visible)}
				aria-label={buttonLabel()}
			>
				<Show when={visible()}>
					{/* TODO */}
				</Show>
				<Show when={!visible()}>
					{/* TODO */}
				</Show>
			</button>
		</div>
	);
}

export default PasswordDisplay;
