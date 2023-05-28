import ty, { checkType } from "lifeboat";
import { MessagePort } from "../common/message_port";
import { CreateClientSessionMessage } from "../common/messages";
import baseLogger from "../common/logger";

const log = baseLogger.sub("join");

log.debug("Join link detected; palantir is correctly installed!");

const joinActionSchema = ty.object({
	action: ty.equals("join" as const),
	hostId: ty.string(),
	username: ty.string(),
	accessToken: ty.string()
});

async function handleAction(msg: Record<string, unknown>): Promise<void> {
	log.debug(`Got message ${JSON.stringify(msg)}`);
	if (!checkType(joinActionSchema, msg)) {
		log.error(`Message received was invalid: ${joinActionSchema.reason}`);
		return;
	}

	MessagePort.bus.post(
		new CreateClientSessionMessage(
			msg.username,
			msg.hostId,
			msg.accessToken
		)
	);
}

window.addEventListener("message", (evt) => {
	if (evt.data.__channel != "palantir") return;
	handleAction(evt.data);
});

document.documentElement.setAttribute("data-palantir-extension-installed", "");
