const enum PacketType {
	AUTH_TOKEN,
	AUTH_ACK,
	SESSION_UPDATE,
	SYNC_MEDIA,
	START_MEDIA_SYNC,
	STOP_MEDIA_SYNC,
	MEDIA_SYNC_INIT
}

export default PacketType;
