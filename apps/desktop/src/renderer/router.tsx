import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	redirect,
} from "@tanstack/react-router";
import { StartupGate } from "./assets/startup-gate";
import { ChampionsScreen } from "./champions-screen";
import { CompetitionHub } from "./competition/competition-hub";
import { CompetitionScreen } from "./competition/competition-screen";
import { CreditsScreen } from "./credits/credits-screen";
import { DatabaseScreen } from "./database/database-screen";
import { DraftScreen, MarketScreen, SettingsScreen } from "./screens";
import { Shell } from "./shell";

// A desktop app has no URLs: the router keeps its history in memory, so the
// window location never changes (plan 02, T7).

const rootRoute = createRootRoute({
	component: () => (
		<StartupGate>
			<Shell />
		</StartupGate>
	),
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	beforeLoad: () => {
		throw redirect({ to: "/draft" });
	},
});

const draftRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "draft",
	component: DraftScreen,
});

const championsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "campeones",
	component: ChampionsScreen,
});

const databaseRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "base-de-datos",
	component: DatabaseScreen,
});

const marketRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "mercado",
	component: MarketScreen,
});

const competitionRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "competicion",
	component: CompetitionScreen,
});

const competitionHubRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "competicion/$competition",
	component: function Hub() {
		const { competition } = competitionHubRoute.useParams();
		return <CompetitionHub key={competition} competition={competition} />;
	},
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "ajustes",
	component: SettingsScreen,
});

const creditsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "ajustes/creditos",
	component: CreditsScreen,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	draftRoute,
	championsRoute,
	databaseRoute,
	marketRoute,
	competitionRoute,
	competitionHubRoute,
	settingsRoute,
	creditsRoute,
]);

export function createAppRouter(initialPath = "/") {
	return createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [initialPath] }),
	});
}

type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
	interface Register {
		router: AppRouter;
	}
}
