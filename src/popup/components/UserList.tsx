import { For, JSX } from "solid-js";
import { Card, Heading, Span } from "@nicholas-roether/palantir-ui-solid";
import { User } from "../../common/messages";

interface UserListProps {
	users: User[];
}

function UserList(props: UserListProps): JSX.Element {
	return (
		<Card>
			<Heading size="2">Users</Heading>
			<For each={props.users}>{(user) => <Span>{user.name}</Span>}</For>
		</Card>
	);
}

export default UserList;
