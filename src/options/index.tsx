import { JSX } from "solid-js";
import { render } from "solid-js/web";
import Eye from "../common/components/eye/Eye";

function Options(): JSX.Element {
	return <Eye size={400} />;
}

const content = document.getElementById("content");
if (!content) throw new Error("Missing content element!");
render(Options, content);
