import ty, { checkType } from "lifeboat";
import { Connection } from "./p2p";
import PacketType from "./packets";
import backgroundLogger from "./logger";

const authLogger = backgroundLogger.sub("auth");

const RESPONSE_TIMEOUT = 5000; // ms

const authPacketSchema = ty.object({
	username: ty.string(),
	token: ty.string()
});

interface AuthFailure {
	success: false;
}

interface AuthSuccess {
	success: true;
	username: string;
}

type AuthResult = AuthFailure | AuthSuccess;

class HostSessionAuth {
	public readonly passphrase: string;

	constructor(passphrase: string) {
		this.passphrase = passphrase;
	}

	public async checkAuth(connection: Connection): Promise<AuthResult> {
		authLogger.info(
			`Authenticating connection from ${connection.remoteId}...`
		);

		const res = await connection.expect(RESPONSE_TIMEOUT);
		if (!res) {
			authLogger.error(
				`Authentication of ${connection.remoteId} timed out`
			);
			return { success: false };
		}

		if (res.type != PacketType.AUTH_TOKEN) {
			authLogger.error(
				`${connection.remoteId} sent packet of invalid type ${res.type}, expected ${PacketType.AUTH_TOKEN}`
			);
			return { success: false };
		}

		if (!checkType(authPacketSchema, res)) {
			authLogger.error(
				`Received malformed auth token packet from ${connection.remoteId}: ${authPacketSchema.reason}`
			);
			return { success: false };
		}

		if (res.token != this.passphrase) {
			authLogger.info(
				`Connection from ${connection.remoteId} refused: incorrect access token`
			);
			return { success: false };
		}

		connection.send({ type: PacketType.AUTH_ACK });
		authLogger.info(
			`Connection from ${connection.remoteId} successfully authenticated`
		);
		return { success: true, username: res.username };
	}
}

class ClientSessionAuth {
	public readonly passphrase: string;
	public readonly username: string;

	constructor(username: string, passphrase: string) {
		this.passphrase = passphrase;
		this.username = username;
	}

	public async authenticate(connection: Connection): Promise<boolean> {
		authLogger.info(
			`Attempting to authenticate to host ${connection.remoteId}...`
		);

		connection.send({
			type: PacketType.AUTH_TOKEN,
			token: this.passphrase,
			username: this.username
		});

		const res = await connection.expect(RESPONSE_TIMEOUT);
		if (!res) {
			authLogger.error(
				`Authentication to host ${connection.remoteId} timed out: ACK packet never received`
			);
			return false;
		}

		if (res.type != PacketType.AUTH_ACK) {
			authLogger.error(
				`${connection.remoteId} sent packet of invalid type ${res.type}, expected ${PacketType.AUTH_ACK}`
			);
			return false;
		}

		authLogger.info(
			`Successfully authenticated to host ${connection.remoteId}`
		);
		return true;
	}
}

export { ClientSessionAuth, HostSessionAuth };
