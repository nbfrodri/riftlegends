import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	redirect,
} from "@tanstack/react-router";
import { StartupGate } from "./assets/startup-gate";
import { ChampionsScreen } from "./champions-screen";
import { CompetitionHub, parseHubSearch } from "./competition/competition-hub";
import { CompetitionScreen } from "./competition/competition-screen";
import { SeriesScreen } from "./competition/series-screen";
import { TeamScreen } from "./competition/team/team-screen";
import { CreditsScreen } from "./credits/credits-screen";
import { DatabaseScreen } from "./database/database-screen";
import { DraftScreen, MarketScreen, SettingsScreen } from "./screens";
import { Shell } from "./shell";
import { TournamentScreen } from "./tournament/tournament-screen";

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

const tournamentRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "torneo",
	component: TournamentScreen,
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
	validateSearch: parseHubSearch,
	component: function Hub() {
		const { competition } = competitionHubRoute.useParams();
		const search = competitionHubRoute.useSearch();
		const navigate = competitionHubRoute.useNavigate();
		return (
			<CompetitionHub
				key={competition}
				competition={competition}
				search={search}
				onSearch={(next) => navigate({ search: next, replace: true })}
			/>
		);
	},
});

const seriesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "competicion/serie/$series",
	component: function Series() {
		const { series } = seriesRoute.useParams();
		return <SeriesScreen key={series} series={series} />;
	},
});

const teamRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "competicion/equipo/$team",
	component: function Team() {
		const { team } = teamRoute.useParams();
		return <TeamScreen key={team} team={team} />;
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
	tournamentRoute,
	championsRoute,
	databaseRoute,
	marketRoute,
	competitionRoute,
	competitionHubRoute,
	seriesRoute,
	teamRoute,
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
