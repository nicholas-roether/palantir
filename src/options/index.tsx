import { JSX } from "solid-js";
import { render } from "solid-js/web";

function Options(): JSX.Element {
	return <h1>TODO</h1>;
}

const content = document.getElementById("content");
if (!content) throw new Error("Missing content element!");
render(Options, content);
