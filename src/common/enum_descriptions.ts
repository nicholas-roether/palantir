import { SessionCloseReason } from "./messages";

function describeSessionCloseReason(reason: SessionCloseReason): string {
	switch (reason) {
		case SessionCloseReason.CLOSED_BY_USER:
			return "Closed by user";
		case SessionCloseReason.DISCONNECTED:
			return "Disconnected";
		case SessionCloseReason.SUPERSEDED:
			return "Superseded by a new session";
		case SessionCloseReason.TAB_CLOSED:
			return "Tab closed";
		case SessionCloseReason.TIMEOUT:
			return "Connection timed out";
		case SessionCloseReason.UNAUTHORIZED:
			return "Authorization failed";
		case SessionCloseReason.UNKNOWN:
			return "Unknown reason; consult logs";
		case SessionCloseReason.NO_MEDIA:
			return "No suitable media found in page";
		case SessionCloseReason.CLIENT_TOO_OLD:
			return "Client version too old";
		case SessionCloseReason.HOST_TOO_OLD:
			return "Host version too old";
		case SessionCloseReason.UNEXPECTED_PACKET:
			return "Received an unexpected packet; this may be due to a version mismatch.";
	}
}

export { describeSessionCloseReason };
