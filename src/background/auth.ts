import ty, { checkType } from "lifeboat";
import { encode } from "base64-arraybuffer";
import { Connection } from "./p2p";
import PacketType from "./packets";

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
		const res = await connection.expectIncoming(RESPONSE_TIMEOUT);
		if (!res || res.type != PacketType.AUTH_TOKEN) return false;
		if (!checkType(authTokenPacketSchema, res)) return false;
		if (res.token != this.accessToken) return false;
		await connection.writer.write({ type: PacketType.AUTH_ACK });
		return true;
	}
}

class ClientSessionAuth {
	public readonly accessToken: string;

	constructor(accessToken: string) {
		this.accessToken = accessToken;
	}

	public async authenticate(connection: Connection): Promise<boolean> {
		await connection.writer.write({
			type: PacketType.AUTH_TOKEN,
			token: this.accessToken
		});
		const res = await connection.expectIncoming(RESPONSE_TIMEOUT);
		if (!res || res.type != PacketType.AUTH_ACK) return false;
		return true;
	}
}

export { ClientSessionAuth, HostSessionAuth };
