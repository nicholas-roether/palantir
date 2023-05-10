import { messageBus, MessagePort } from "../common/message_port";
import {
	CloseSessionMessage,
	ConnectionState,
	CreateHostSessionMessage,
	GetSessionStatusMessage,
	Message,
	MessageType,
	SessionCloseReason,
	SessionStatus,
	SessionStatusUpdateMessage,
	SessionType,
	User,
	UserRole
} from "../common/messages";
import { EventEmitter } from "../common/typed_events";
import { Connection, Peer } from "./p2p";
import { ClientSessionAuth, HostSessionAuth } from "./auth";
import backgroundLogger from "./logger";
import PacketType from "./packets";
import ty, { checkType } from "lifeboat";
import { CreateClientSessionMessage } from "../common/messages";
import { describeSessionCloseReason } from "../common/enum_descriptions";

const log = backgroundLogger.sub("sessionServer");

const sessionUpdatePacketSchema = ty.object({
	users: ty.array(
		ty.object({
			name: ty.string(),
			role: ty.enum(UserRole.GUEST, UserRole.HOST)
		})
	)
});

class Session extends EventEmitter<{ closed: SessionCloseReason }> {
	public readonly tabId: number;
	private readonly tab: browser.tabs.Tab;
	private isOpen = true;
	private status: SessionStatus | null = null;

	constructor(tab: browser.tabs.Tab) {
		super();
		this.tab = tab;

		if (!this.tab.id) {
			throw new Error("Cannot open a session on a tab without a tabId");
		}
		this.tabId = this.tab.id;

		browser.tabs.onRemoved.addListener((tabId) => {
			if (tabId == this.tab.id) this.close(SessionCloseReason.TAB_CLOSED);
		});
	}

	public openPort(href: string): MessagePort {
		const name = `tab${this.tabId}/${encodeURIComponent(href)}`;
		return MessagePort.connect(name);
	}

	public close(reason: SessionCloseReason): void {
		if (!this.isOpen) return;
		this.isOpen = false;
		this.status = null;
		this.emit("closed", reason);
		this.broadcastStatus();
	}

	public broadcastStatus(): void {
		messageBus.post(
			new SessionStatusUpdateMessage(this.tabId, this.status)
		);
	}

	public postStatusUpdate(status: SessionStatus): void {
		if (!this.isOpen) return;
		this.status = status;
		this.broadcastStatus();
	}
}

class ClientSessionHandler {
	private static readonly CONNECTION_TIMEOUT = 5000; // ms

	private readonly session: Session;
	private readonly peer: Peer;
	private readonly username: string;
	private readonly hostId: string;
	private readonly auth: ClientSessionAuth;

	private connectionState = ConnectionState.CONNECTING;
	private users: User[];

	constructor(
		session: Session,
		username: string,
		hostId: string,
		accessToken: string
	) {
		this.session = session;
		this.username = username;
		this.hostId = hostId;
		this.users = [{ role: UserRole.GUEST, name: this.username }];
		this.auth = new ClientSessionAuth(username, accessToken);
		this.peer = new Peer((conn) => this.onConnection(conn));

		this.session.on("closed", () => this.stop());
	}

	public start(): void {
		setTimeout(() => {
			if (this.connectionState != ConnectionState.CONNECTED) {
				this.session.close(SessionCloseReason.TIMEOUT);
			}
		}, ClientSessionHandler.CONNECTION_TIMEOUT);

		this.peer.connectTo(this.hostId);
		this.postStatusUpdate();
	}

	public stop(): void {
		this.connectionState = ConnectionState.DISCONNECTED;
		this.peer.close();
	}

	private async onConnection(connection: Connection): Promise<void> {
		if (this.connectionState != ConnectionState.CONNECTING) {
			log.warn(
				`Ignoring incoming connection with ${connection.remoteId} on client session`
			);
			connection.close();
			return;
		}

		log.info(
			`Client session on tab ${this.session.tabId} established connection to host`
		);

		this.connectionState = ConnectionState.CONNECTED;
		this.postStatusUpdate();

		const authResult = await this.auth.authenticate(connection);
		if (!authResult) {
			log.warn(
				`Authorization of client session on tab ${this.session.tabId} failed!`
			);
			this.session.close(SessionCloseReason.UNAUTHORIZED);
			return;
		}

		connection.on("close", () => {
			log.warn(
				`Client session on tab ${this.session.tabId} lost connection!`
			);
			this.connectionState = ConnectionState.DISCONNECTED;
			this.session.close(SessionCloseReason.DISCONNECTED);
		});

		await this.listen(connection);
	}

	private async listen(connection: Connection): Promise<void> {
		for await (const packet of connection.listen()) {
			log.debug(
				`Client session on tab ${
					this.session.tabId
				} recieved packet: ${JSON.stringify(packet)}`
			);
			if (packet.type != PacketType.SESSION_UPDATE) continue;
			if (!checkType(sessionUpdatePacketSchema, packet)) {
				log.warn(
					`Client session on tab ${this.session.tabId} received a malformed session update packet: ${sessionUpdatePacketSchema.reason}`
				);
				continue;
			}
			this.users = packet.users;
		}
	}

	private postStatusUpdate(): void {
		this.session.postStatusUpdate({
			type: SessionType.CLIENT,
			hostId: this.hostId,
			accessToken: this.auth.accessToken,
			connectionState: this.connectionState,
			users: this.users
		});
	}
}

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

class SessionServer {
	private readonly sessions: Map<number, Session>;

	constructor() {
		this.sessions = new Map();
	}

	public start(): void {
		messageBus.on("message", (msg) => this.onMessage(msg));
	}

	private async onMessage(msg: Message): Promise<void> {
		switch (msg.type) {
			case MessageType.CREATE_CLIENT_SESSION:
				await this.createClientSession(msg);
				break;
			case MessageType.CREATE_HOST_SESSION:
				await this.createHostSession(msg);
				break;
			case MessageType.GET_SESSION_STATUS:
				this.getSessionStatus(msg);
				break;
			case MessageType.CLOSE_SESSION:
				this.closeSession(msg);
		}
	}

	private async createClientSession({
		tabId,
		hostId,
		username,
		accessToken
	}: CreateClientSessionMessage): Promise<void> {
		log.info(
			`Starting client session with username "${username}" on tab ${tabId}...`
		);

		const sessionHandler = new ClientSessionHandler(
			await this.createSession(tabId),
			username,
			hostId,
			accessToken
		);

		sessionHandler.start();
	}

	private async createHostSession({
		tabId,
		username
	}: CreateHostSessionMessage): Promise<void> {
		log.info(
			`Starting host session with username "${username}" on tab ${tabId}...`
		);

		const sessionHandler = new HostSessionHandler(
			await this.createSession(tabId),
			username
		);
		sessionHandler.start();
	}

	private async createSession(tabId: number): Promise<Session> {
		const tab = await browser.tabs.get(tabId);
		const session = new Session(tab);
		const prevSession = this.sessions.get(tabId);
		if (prevSession) prevSession.close(SessionCloseReason.SUPERSEDED);

		this.sessions.set(tabId, session);
		return session;
	}

	private getSessionStatus({ tabId }: GetSessionStatusMessage): void {
		this.sessions.get(tabId)?.broadcastStatus();
	}

	private closeSession({ tabId, reason }: CloseSessionMessage): void {
		log.info(
			`Closing session on tab ${tabId} (${describeSessionCloseReason(
				reason
			)})`
		);
		this.sessions.get(tabId)?.close(reason);
	}
}

export { SessionServer };
