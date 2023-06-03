import { JSX, Show, createSignal } from "solid-js";
import { css } from "@emotion/css";
import { EyeClosedIcon, EyeOpenIcon } from "../../common/components/icons";

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
	min-width: 6em;
`;

const passwordText = css`
	flex: 1;
	font-family: monospace;
	font-size: 0.8em;
	padding: 0 10px;
	overflow-x: auto;
`;

const passwordVisibleButton = css`
	width: 3em;
	height: 100%;
	border: none;
	background-color: var(--pui-color-surface);
	color: var(--pui-color-text);
	cursor: pointer;
	
	& > svg {
		transition: filter var(--pui-duration-hover) ease-out;	
	}

	&:hover > svg {
		filter: drop-shadow(0 0 8px var(--pui-color-active));
	}
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
