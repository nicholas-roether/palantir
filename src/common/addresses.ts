function frameAddress(frameHref: string): string {
	return `frame:${encodeURIComponent(frameHref)}`;
}

export { frameAddress };
