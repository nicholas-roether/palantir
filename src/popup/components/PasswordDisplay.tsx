import { JSX, Show, createSignal } from "solid-js";
import EyeClosedIcon from "~icons/game-icons/sight-disabled";
import EyeOpenIcon from "~icons/game-icons/semi-closed-eye";
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
	height: 2em;
	align-items: center;
	background-color: var(--pui-color-background);
	border: 3px var(--pui-color-surface) solid;
`;

const passwordText = css`
	flex: 1;
	font-family: monospace;
	font-size: 0.8em;
`;

const passwordVisibleButton = css`
	width: 3em;
	border: none;
	background-color: transparent;
	color: var(--pui-color-text);
	cursor: pointer;
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
					<EyeOpenIcon />
				</Show>
				<Show when={!visible()}>
					<EyeClosedIcon />
				</Show>
			</button>
		</div>
	);
}

export default PasswordDisplay;
