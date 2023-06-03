import { For, JSX } from "solid-js";
import { Card, Heading } from "@nicholas-roether/palantir-ui-solid";
import { User } from "../../common/messages";
import { css } from "@emotion/css";

interface UserListProps {
	users: User[];
}

const usersListCard = css`
	display: block;
	width: 100%;
	padding-bottom: 10px;
`;

const userList = css`
	border: 3px var(--pui-color-background) solid;
`

const userTile = css`
	&:nth-child(even) {
		background-color: var(--pui-color-background);
	}
`;

function UserList(props: UserListProps): JSX.Element {
	return (
		<Card class={usersListCard}>
			<Heading size="2">Users</Heading>
			<div class={userList}>
				<For each={props.users}>
					{(user) => <div class={userTile}>{user.name}</div>}
				</For>
				{/* TODO: remove */}
				<div class={userTile}>Test User</div>
				<div class={userTile}>Test User</div>
				<div class={userTile}>Test User</div>
				<div class={userTile}>Test User</div>
				<div class={userTile}>Test User</div>
				<div class={userTile}>Test User</div>
				<div class={userTile}>Test User</div>
			</div>
		</Card>
	);
}

export default UserList;
