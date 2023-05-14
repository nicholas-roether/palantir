function frameAddress(tabId: number, frameHref: string): string {
	return `tab:${tabId}/${encodeURIComponent(frameHref)}`;
}

export { frameAddress };
