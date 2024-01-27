function notify(title: string, message: string): void {
	browser.notifications.create({
		type: "basic",
		title,
		message
	});
}

export { notify };
