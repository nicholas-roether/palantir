import ty, { checkType } from "lifeboat";
import { MessagePort } from "../common/message_port";
import { CreateClientSessionMessage } from "../common/messages";

const joinActionSchema = ty.object({
	action: ty.equals("join" as const),
	hostId: ty.string(),
	username: ty.string(),
	accessToken: ty.string()
});

async function handleAction(msg: Record<string, unknown>): Promise<void> {
	if (!checkType(joinActionSchema, msg)) return;
	const tab = await browser.tabs.getCurrent();
	if (!tab || !tab.id) return;
	MessagePort.bus.post(
		new CreateClientSessionMessage(
			tab.id,
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
