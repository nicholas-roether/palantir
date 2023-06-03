import { For, JSX, Match, Switch } from "solid-js";
import { Card, Heading } from "@nicholas-roether/palantir-ui-solid";
import { User, UserRole } from "../../common/messages";
import { css } from "@emotion/css";
import { ClientIcon, HostIcon } from "../../common/components/icons";

interface UserTileProps {
	user: User;
}

const userTile = css`
	display: flex;
	gap: 10px;
	padding: 5px;
	text-align: left;

	&:nth-child(even) {
		background-color: var(--pui-color-background);
	}
`;

const userTileIcon = css`
	width: 2em;
	text-align: center;
`;

const userTileName = css`
	flex: 1;
`;

function UserTile(props: UserTileProps): JSX.Element {
	return (
		<div class={userTile}>
			<div class={userTileIcon}>
				<Switch>
					<Match when={props.user.role == UserRole.HOST}>
						<HostIcon />
					</Match>
					<Match when={props.user.role == UserRole.GUEST}>
						<ClientIcon />
					</Match>
				</Switch>
			</div>
			<div class={userTileName}>{props.user.name}</div>
		</div>
	);
}

interface UserListProps {
	users: User[];
}

const usersListCard = css`
	display: block;
	width: 100%;
	padding-bottom: 10px;
`;

const usersList = css`
	border: 3px var(--pui-color-background) solid;
`

function UserList(props: UserListProps): JSX.Element {
	return (
		<Card class={usersListCard}>
			<Heading size="2">Users</Heading>
			<div class={usersList}>
				<For each={props.users}>
					{(user) => <UserTile user={user} />}
				</For>
			</div>
		</Card>
	);
}

export default UserList;
