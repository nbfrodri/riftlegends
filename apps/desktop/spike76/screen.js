const button = document.querySelector("button");
function render({ ordinal, facts, wins, labels, version }) {
	const over = facts.at(-1)[0] === "winner";
	document.querySelector("#score").textContent = Object.entries(wins)
		.map(([team, score]) => `${team} ${score}`)
		.join(" · ");
	document.querySelector("#progress").textContent = [
		version,
		`${labels["spike76.turn"]} ${ordinal}`,
	].join(" · ");
	button.textContent = labels[over ? "spike76.finished" : "spike76.advance"];
	button.disabled = over;
	document.querySelector("ol").replaceChildren(
		...facts
			.filter(([type]) => type === "ban" || type === "pick")
			.slice(-20)
			.map(([action, game, turn, team, champion]) => {
				const item = document.createElement("li");
				item.textContent =
					game +
					"." +
					turn +
					" " +
					team +
					" · " +
					labels[`spike76.${action}`] +
					" · " +
					champion;
				return item;
			}),
	);
	document.body.dataset.ordinal = ordinal;
	document.dispatchEvent(new Event("saved"));
}
window.ready = window.draft.read().then(render);
button.addEventListener("click", async () => {
	button.disabled = true;
	try {
		render(
			await window.draft.advance(Number(document.body.dataset.ordinal) + 1),
		);
	} catch (error) {
		document.querySelector("#progress").textContent = String(error);
	}
});
