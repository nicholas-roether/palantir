import { JSX } from "solid-js";
import { createStore } from "solid-js/store";
import { css } from "@emotion/css";
import { TextInput, Button } from "@nicholas-roether/palantir-ui-solid";
import { createHostSession } from "../handle-session";
import { HostIcon } from "../../common/components/icons";

interface SessionCreationFormState {
	username: string;
	passphrase: string;
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
		username: "",
		passphrase: ""
	});

	function onSubmit(evt: SubmitEvent): void {
		evt.preventDefault();
		if (state.username.length == 0) return;
		createHostSession(state.username, state.passphrase);
	}

	return (
		<form class={sessionCreationForm} onSubmit={onSubmit}>
			<TextInput
				name="username"
				placeholder="Nickname"
				aria-label="Nickname"
				value={state.username}
				onChange={(evt) => setState({ username: evt.target.value })}
			/>
			<TextInput
				name="passphrase"
				placeholder="Passphrase"
				aria-label="Passphrase"
				value={state.passphrase}
				onChange={(evt) => setState({ passphrase: evt.target.value })}
			/>
			<Button large smoldering type="submit">
				<HostIcon /> Host Session
			</Button>
		</form>
	);
}

export default SessionCreationForm;
