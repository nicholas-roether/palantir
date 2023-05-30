import { For, JSX } from "solid-js";
import { Card, Heading } from "@nicholas-roether/palantir-ui-solid";
import { User } from "../../common/messages";
import { css } from "@emotion/css";

interface UserListProps {
	users: User[];
}

const usersListCard = css`
	display: block;
	width: 80%;
	padding-bottom: 10px;
`;

const userTile = css`
	&:nth-child(odd) {
		background-color: var(--pui-color-background);
	}
`;

function UserList(props: UserListProps): JSX.Element {
	return (
		<Card class={usersListCard}>
			<Heading size="2">Users</Heading>
			<For each={props.users}>
				{(user) => <div class={userTile}>{user.name}</div>}
			</For>
		</Card>
	);
}

export default UserList;
