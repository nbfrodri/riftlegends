import { loadRealContent } from "@rift-legends/core";
import { createI18n } from "@rift-legends/i18n";
import { TooltipProvider } from "@rift-legends/ui-kit/components/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createCoreHost } from "../src/core-host/host";
import { CoreProvider } from "../src/renderer/core";
import { TournamentScreen } from "../src/renderer/tournament/tournament-screen";
import type { CoreApi, CoreCommand } from "../src/shared/bridge";

// U9 (plan 31): the tournament setup against the real core host.

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function hostCore() {
	const host = createCoreHost();
	let id = 0;
	const call = (op: "open" | "send" | "query", body?: unknown) =>
		host.receive({
			id: ++id,
			op,
			...(body !== undefined && { body: JSON.stringify(body) }),
		}).result;
	const sent: CoreCommand[] = [];
	const api = {
		open: async () => call("open") as never,
		send: async (command: CoreCommand) => {
			sent.push(command);
			return call("send", command) as never;
		},
		query: async (query: unknown) => call("query", query) as never,
		subscribe: () => () => {},
	} satisfies CoreApi;
	return { api, sent };
}

async function renderSetup(locale = "en-US", content = "real") {
	window.history.replaceState(
		null,
		"",
		content === "fictional" ? "?content=fictional" : "/",
	);
	vi.spyOn(crypto, "getRandomValues").mockReturnValue(new Uint32Array([1234]));
	const core = hostCore();
	const i18n = await createI18n(locale);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={client}>
				<TooltipProvider>
					<CoreProvider api={core.api}>
						<TournamentScreen />
					</CoreProvider>
				</TooltipProvider>
			</QueryClientProvider>
		</I18nextProvider>,
	);
	return { ...core, user: userEvent.setup() };
}

const nameOf = (id: string) =>
	loadRealContent().match.teams.find((team) => team.id === id)?.name ?? id;
const lck = loadRealContent()
	.match.teams.filter(({ league }) => league === "LCK")
	.sort((a, b) => a.seed - b.seed);

const radio = (group: string, name: string) =>
	within(screen.getByRole("radiogroup", { name })).getByRole("radio", {
		name: group,
	}) as HTMLInputElement;

async function pick(
	user: ReturnType<typeof userEvent.setup>,
	combobox: string,
	option: string,
) {
	await user.click(screen.getByRole("combobox", { name: combobox }));
	await user.click(
		await screen.findByRole("option", {
			name: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
		}),
	);
}

const start = () => screen.getByRole("button", { name: "Start tournament" });

describe("U9: tournament setup", () => {
	test("offers the presets and custom, watch only, fearless hard and a seed", async () => {
		await renderSetup();
		expect(
			await screen.findByRole("heading", { level: 1, name: "Tournament" }),
		).toBeTruthy();
		await screen.findByRole("radiogroup", { name: "Format" });
		for (const name of ["First Stand", "MSI", "Worlds", "Custom"])
			expect(radio(name, "Format")).toBeTruthy();
		expect(radio("MSI", "Format").checked).toBe(true);
		expect(radio("Hard", "Fearless").checked).toBe(true);
		expect(
			(await screen.findByRole("combobox", { name: "My team" })).textContent,
		).toContain("Watch only");
		// #608: a plain text field, without the +/- spin buttons.
		expect(screen.queryByRole("spinbutton")).toBeNull();
		expect(
			(screen.getByRole("textbox", { name: "Seed" }) as HTMLInputElement)
				.value,
		).toBe("1234");
	});

	test("the seed takes only digits", async () => {
		const { user } = await renderSetup();
		const seed = (await screen.findByRole("textbox", {
			name: "Seed",
		})) as HTMLInputElement;
		await user.clear(seed);
		await user.type(seed, "4x2");
		expect(seed.value).toBe("42");
	});

	test("MSI fills each slot with the best seed of its league, and a slot can change", async () => {
		const { user, sent } = await renderSetup();
		const slot = await screen.findByRole("combobox", { name: "LCK, place 2" });
		await waitFor(() => expect(slot.textContent).toContain(lck[1]?.name));
		expect(
			screen.getByRole("combobox", { name: "LCK, place 1" }).textContent,
		).toContain(lck[0]?.name);
		const outsider = lck[3];
		if (!outsider) throw new Error("LCK needs four teams");
		await pick(user, "LCK, place 2", outsider.name);
		await pick(user, "My team", outsider.name);
		await user.click(radio("Soft", "Fearless"));
		await waitFor(() => expect(start().hasAttribute("disabled")).toBe(false));
		await user.click(start());
		const create = sent.find(({ kind }) => kind === "tournament.create");
		expect(create?.payload).toMatchObject({
			format: { kind: "preset", preset: "msi" },
			seed: 1234,
			fearless: "soft",
			humanTeam: outsider.id,
		});
		expect((create?.payload as { teams: string[] } | undefined)?.teams[0]).toBe(
			outsider.id,
		);
		expect(
			await screen.findByRole("heading", { name: "Tournament ready" }),
		).toBeTruthy();
	});

	test("a team twice is flagged at its slot and blocks the start", async () => {
		const { user } = await renderSetup();
		await screen.findByRole("combobox", { name: "LEC, place 2" });
		await waitFor(() => expect(start().hasAttribute("disabled")).toBe(false));
		await pick(user, "LEC, place 2", nameOf(lck[1]?.id ?? ""));
		expect(
			await screen.findByRole("combobox", {
				name: "LEC, place 2",
				description: "This team is already in the tournament.",
			}),
		).toBeTruthy();
		expect(start().hasAttribute("disabled")).toBe(true);
	});

	test("the custom editor explains an invalid stage next to it and blocks the start", async () => {
		const { user } = await renderSetup();
		await user.click(await screen.findByRole("radio", { name: "Custom" }));
		const first = screen.getByRole("group", { name: "Stage 1" });
		await user.click(within(first).getByRole("combobox", { name: "Block" }));
		await user.click(
			await screen.findByRole("option", { name: "Double elimination" }),
		);
		await waitFor(() => expect(start().hasAttribute("disabled")).toBe(false));
		await user.click(screen.getByRole("button", { name: "Remove team 8" }));
		await user.click(screen.getByRole("button", { name: "Remove team 7" }));
		expect(
			await within(first).findByText(
				"Double elimination needs 4, 8, 16 or 32 teams.",
			),
		).toBeTruthy();
		expect(start().hasAttribute("disabled")).toBe(true);
		await user.click(screen.getByRole("button", { name: "Add team" }));
		await user.click(screen.getByRole("button", { name: "Add team" }));
		await waitFor(() => expect(start().hasAttribute("disabled")).toBe(false));
	});

	test("a second stage takes the best teams of the first and sends both", async () => {
		const { user, sent } = await renderSetup();
		await user.click(await screen.findByRole("radio", { name: "Custom" }));
		const second = screen.getByRole("group", { name: "Stage 2" });
		await user.click(within(second).getByRole("radio", { name: "Double" }));
		await user.click(within(second).getByRole("radio", { name: "Bo5" }));
		await waitFor(() => expect(start().hasAttribute("disabled")).toBe(false));
		await user.click(start());
		await screen.findByRole("heading", { name: "Tournament ready" });
		const create = sent.find(({ kind }) => kind === "tournament.create");
		expect(create?.payload).toMatchObject({
			format: {
				kind: "custom",
				stages: [
					{ type: "roundRobin", bestOf: 1 },
					{ type: "doubleElim", size: 4, bestOf: 5 },
				],
			},
		});
		expect(
			(create?.payload as { teams: string[] } | undefined)?.teams,
		).toHaveLength(8);
	});

	test("without real leagues only the custom editor is offered", async () => {
		await renderSetup("es-ES", "fictional");
		expect(
			await screen.findByRole("heading", { level: 1, name: "Torneo" }),
		).toBeTruthy();
		await screen.findByRole("radiogroup", { name: "Formato" });
		expect(radio("Personalizado", "Formato").checked).toBe(true);
		expect(radio("MSI", "Formato").disabled).toBe(true);
		expect(
			(await screen.findByRole("combobox", { name: "Mi equipo" })).textContent,
		).toContain("Solo ver");
	});
});
