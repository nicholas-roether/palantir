import { JSX } from "solid-js/jsx-runtime";
import { render } from "solid-js/web";

function Popup(): JSX.Element {
    return <h1>Hello World!</h1>
}

const content = document.getElementById("content");
if (!content) throw new Error("Missing content element!");
render(Popup, content);