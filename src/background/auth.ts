import ty, { checkType } from "lifeboat";
import { encode } from "base64-arraybuffer";
import { Connection } from "./p2p";
import PacketType from "./packets";
import backgroundLogger from "./logger";

const authLogger = backgroundLogger.sub("auth");

const TOKEN_SIZE = 24;
const RESPONSE_TIMEOUT = 5000; // ms

const authTokenPacketSchema = ty.object({
	token: ty.string()
});

function generateToken(): string {
	const array = new Uint8Array(TOKEN_SIZE);
	crypto.getRandomValues(array);
	return encode(array.buffer);
}

class HostSessionAuth {
	public readonly accessToken: string;

	constructor() {
		this.accessToken = generateToken();
	}

	public async checkAuth(connection: Connection): Promise<boolean> {
		authLogger.info(`Authenticating connection from ${connection.remoteId}...`);

		const res = await connection.expectIncoming(RESPONSE_TIMEOUT);
		if (!res) {
			authLogger.error(`Authentication of ${connection.remoteId} timed out`);
			return false;
		}

		if (res.type != PacketType.AUTH_TOKEN) {
			authLogger.error(
				`${connection.remoteId} sent packet of invalid type ${res.type}, expected ${PacketType.AUTH_TOKEN}`
			);
			return false;
		}

		if (!checkType(authTokenPacketSchema, res)) {
			authLogger.error(
				`Received malformed auth token packet from ${connection.remoteId}: ${authTokenPacketSchema.reason}`
			);
			return false;
		}

		if (res.token != this.accessToken) {
			authLogger.info(
				`Connection from ${connection.remoteId} refused: incorrect access token`
			);
			return false;
		}

		await connection.writer.write({ type: PacketType.AUTH_ACK });
		authLogger.info(
			`Connection from ${connection.remoteId} successfully authenticated`
		);
		return true;
	}
}

class ClientSessionAuth {
	public readonly accessToken: string;

	constructor(accessToken: string) {
		this.accessToken = accessToken;
	}

	public async authenticate(connection: Connection): Promise<boolean> {
		authLogger.info(
			`Attempting to authenticate to host ${connection.remoteId}...`
		);

		await connection.writer.write({
			type: PacketType.AUTH_TOKEN,
			token: this.accessToken
		});

		const res = await connection.expectIncoming(RESPONSE_TIMEOUT);
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
