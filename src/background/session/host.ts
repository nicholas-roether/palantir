import { Session } from ".";
import {
	ConnectionState,
	SessionType,
	User,
	UserRole
} from "../../common/messages";
import { HostSessionAuth } from "../auth";
import { Connection, Peer } from "../p2p";
import PacketType from "../packets";
import sessionLogger from "./logger";

const log = sessionLogger.sub("host");

interface ConnectedUser {
	username: string;
	connection: Connection;
}

class HostSessionHandler {
	private readonly session: Session;
	private readonly peer: Peer;
	private readonly username;
	private readonly auth: HostSessionAuth;
	private readonly connectedUsers: Set<ConnectedUser>;

	constructor(session: Session, username: string) {
		this.session = session;
		this.peer = new Peer((conn) => this.onConnection(conn));
		this.username = username;
		this.auth = new HostSessionAuth();
		this.connectedUsers = new Set();

		this.session.on("closed", () => this.stop());
	}

	public async getId(): Promise<string> {
		return await this.peer.getId();
	}

	public get accessToken(): string {
		return this.auth.accessToken;
	}

	public start(): void {
		this.peer.listen();
		this.postStatusUpdate();
		log.info(
			`Host session on tab ${this.session.tabId} is now listening for connections.`
		);
	}

	public stop(): void {
		this.peer.close();
	}

	private async onConnection(connection: Connection): Promise<void> {
		const authRes = await this.auth.checkAuth(connection);
		if (!authRes.success) {
			connection.close();
			return;
		}
		log.info(
			`User ${authRes.username} connected to host session on tab ${this.session.tabId}`
		);

		const user: ConnectedUser = { username: authRes.username, connection };
		this.connectedUsers.add(user);
		await this.postStatusUpdate();
		this.sendSessionUpdate();

		connection.on("close", async () => {
			this.connectedUsers.delete(user);
			await this.postStatusUpdate();
			this.sendSessionUpdate();

			log.info(
				`User ${authRes.username} has disconnected from session on tab ${this.session.tabId}`
			);
		});
	}

	private sendSessionUpdate(): void {
		log.debug(
			`Host session on tab ${this.session.tabId} is broadcasting a status update`
		);
		const users = this.getUsers();
		for (const connectedUser of this.connectedUsers) {
			connectedUser.connection.send({
				type: PacketType.SESSION_UPDATE,
				users
			});
		}
	}

	private async postStatusUpdate(): Promise<void> {
		this.session.postStatusUpdate({
			type: SessionType.HOST,
			hostId: await this.getId(),
			accessToken: this.accessToken,
			connectionState: ConnectionState.CONNECTED,
			users: this.getUsers()
		});
	}

	private getUsers(): User[] {
		const users: User[] = [{ role: UserRole.HOST, name: this.username }];
		for (const connectedUser of this.connectedUsers) {
			users.push({ role: UserRole.GUEST, name: connectedUser.username });
		}
		return users;
	}
}

export { HostSessionHandler };
