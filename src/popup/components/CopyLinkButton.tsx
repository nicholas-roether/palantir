import { JSX } from "solid-js";
import { Button } from "@nicholas-roether/palantir-ui-solid";
import { ShareIcon } from "../../common/components/icons";

interface CopyLinkButtonProps {
	href: string;
	children: JSX.Element;
}

function CopyLinkButton(props: CopyLinkButtonProps): JSX.Element {
	function onClick(evt: MouseEvent): void {
		evt.preventDefault();
		navigator.clipboard.writeText(props.href);
	}

	return (
		<Button onClick={onClick}>
			<ShareIcon /> {props.children}
		</Button>
	);
}

export default CopyLinkButton;
