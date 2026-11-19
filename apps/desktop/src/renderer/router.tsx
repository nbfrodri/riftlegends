import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	redirect,
} from "@tanstack/react-router";
import { DraftScreen, MarketScreen, SettingsScreen } from "./screens";
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

const draftRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "draft",
	component: DraftScreen,
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
	draftRoute,
	marketRoute,
	settingsRoute,
]);

export function createAppRouter(initialPath = "/") {
	return createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [initialPath] }),
	});
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
	interface Register {
		router: AppRouter;
	}
}
