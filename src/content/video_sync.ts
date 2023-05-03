import { VideoSyncAction, VideoSyncMessage } from "../common/messages";
import { EventEmitter } from "../common/typed_events";

const syncEvents = new EventEmitter<{ message: VideoSyncMessage }>();

let snycElem: HTMLMediaElement | null;

let heartbeatId: number | undefined;

const HEARTBEAT_INTERVAL = 1000;

function startSync(elem: HTMLMediaElement, heartbeat: boolean): void {
	snycElem = elem;
	snycElem.addEventListener("play", syncPlay);
	snycElem.addEventListener("pause", syncPause);
	snycElem.addEventListener("seeked", syncTime);

	if (heartbeat) {
		heartbeatId = setInterval(syncTime, HEARTBEAT_INTERVAL);
	}
}

function stopSync(): void {
	if (!snycElem) return;
	snycElem.removeEventListener("play", syncPlay);
	snycElem.removeEventListener("pause", syncPause);
	snycElem.removeEventListener("seeked", syncTime);
	snycElem = null;

	if (heartbeatId) clearInterval(heartbeatId);
}

function handleSyncMessage(message: VideoSyncMessage): void {
	if (!snycElem) return;

	const videoTime = getCurrentVideoTime(message);
	setVideoTime(snycElem, videoTime);

	switch (message.action) {
		case VideoSyncAction.PLAY:
			snycElem.play();
			break;
		case VideoSyncAction.PAUSE:
			snycElem.pause();
	}
}

function getCurrentVideoTime(message: VideoSyncMessage): number {
	if (message.action != VideoSyncAction.SYNC) return message.time;
	const packetTravelTime = Date.now() - message.timestamp;
	return message.time + packetTravelTime;
}

function getVideoTime(video: HTMLMediaElement): number {
	return Math.round(video.currentTime * 1000);
}

function setVideoTime(video: HTMLMediaElement, time: number): void {
	video.currentTime = time / 1000;
}

function makeSyncMessage(
	syncElem: HTMLMediaElement,
	action: VideoSyncAction
): VideoSyncMessage {
	return new VideoSyncMessage(Date.now(), action, getVideoTime(syncElem));
}

function syncPlay(): void {
	if (!snycElem) return;
	syncEvents.emit("message", makeSyncMessage(snycElem, VideoSyncAction.PLAY));
}

function syncPause(): void {
	if (!snycElem) return;
	syncEvents.emit(
		"message",
		makeSyncMessage(snycElem, VideoSyncAction.PAUSE)
	);
}

function syncTime(): void {
	if (!snycElem) return;
	syncEvents.emit("message", makeSyncMessage(snycElem, VideoSyncAction.SYNC));
}

export { startSync, stopSync, handleSyncMessage };
