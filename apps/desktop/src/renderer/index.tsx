import { createRoot } from "react-dom/client";
import { TitleBar } from "./title-bar";

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<>
			<TitleBar controls={window.riftlegends.window} />
			<main />
		</>,
	);
}
