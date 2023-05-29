import { JSX } from "solid-js";
import { Button } from "@nicholas-roether/palantir-ui-solid";

interface CopyLinkButtonProps {
	href: string;
	children: JSX.Element
}

function CopyLinkButton({ href, children }: CopyLinkButtonProps): JSX.Element {
	function onClick(evt: MouseEvent): void {
		evt.preventDefault();
		navigator.clipboard.writeText(href);
	}

	return <Button onClick={onClick}>{children}</Button>;
}

export default CopyLinkButton;
