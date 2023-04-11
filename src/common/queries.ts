function getChildNumber(child: HTMLElement, element: HTMLElement): number {
	for (let i = 0; i < element.children.length; i++) {
		if (element.children[i] == child) return i;
	}
	throw new Error("Child not found in element");
}

function getQueryFor(element: HTMLElement): string {
	if (element instanceof HTMLBodyElement) return "body";
	if (element.id) return `#${element.id}`;
	const parent = element.parentElement;
	if (!parent) throw new Error("Element has no parent");
	const childNr = getChildNumber(element, parent);
	return `${getQueryFor(parent)} > ${element.tagName.toLowerCase()}:nth-child(${
		childNr + 1
	})`;
}

export { getQueryFor };
