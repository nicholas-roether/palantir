import { Message, MessageType, VideosFoundMessage } from "./common/messages";
import { getQueryFor } from "./common/queries";


function findVideos(): string[] {
    window.name
    return Array.from(window.document.querySelectorAll("video")).map((video) => getQueryFor(video));
}

function onFindVideos() {
    const videos = findVideos();
    browser.runtime.sendMessage(new VideosFoundMessage(videos));
}

browser.runtime.onMessage.addListener((message: Message) => {
    if (message.type == MessageType.FIND_VIDEOS) {
        onFindVideos();
    }
})