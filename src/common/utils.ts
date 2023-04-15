function promiseWithTimeout<T>(
	promise: Promise<T>,
	defaultValue: T,
	timeout: number
): Promise<T> {
	return new Promise((res) => {
		setTimeout(() => res(defaultValue), timeout);
		promise.then((val) => res(val));
	});
}

export { promiseWithTimeout };
