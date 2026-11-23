import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { ChampionsScreen } from "./champions-screen";
import { DraftFlow } from "./draft/draft-screen";
import { DraftSessionProvider } from "./draft/session";
import { MarketScreen, SettingsScreen } from "./screens";
import { Shell } from "./shell";

// A desktop app has no URLs: the router keeps its history in memory, so the
// window location never changes (plan 02, T7).

const rootRoute = createRootRoute({ component: Shell });

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	beforeLoad: () => {
		throw redirect({ to: "/draft" });
	},
});

const sessionRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "draftSession",
	component: () => (
		<DraftSessionProvider>
			<Outlet />
		</DraftSessionProvider>
	),
});

const draftRoute = createRoute({
	getParentRoute: () => sessionRoute,
	path: "draft",
	component: DraftFlow,
});

const championsRoute = createRoute({
	getParentRoute: () => sessionRoute,
	path: "campeones",
	component: ChampionsScreen,
});

const marketRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "mercado",
	component: MarketScreen,
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "ajustes",
	component: SettingsScreen,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	sessionRoute.addChildren([draftRoute, championsRoute]),
	marketRoute,
	settingsRoute,
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
