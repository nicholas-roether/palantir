import { JSX } from "solid-js";
import { createStore } from "solid-js/store";
import { css } from "@emotion/css";
import { TextInput, Button } from "@nicholas-roether/palantir-ui-solid";
import { createHostSession } from "../handle-session";

interface SessionCreationFormState {
	username: string;
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
		username: ""
	});

	function onSubmit(evt: SubmitEvent): void {
		evt.preventDefault();
		if (state.username.length == 0) return;
		createHostSession(state.username);
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
			<Button large smoldering type="submit">
				Host Session
			</Button>
		</form>
	);
}

export default SessionCreationForm;
