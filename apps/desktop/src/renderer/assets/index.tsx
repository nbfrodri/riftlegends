import type { AssetStatus, ChampionCatalog } from "@rift-legends/contracts";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { AssetsApi } from "../../shared/bridge";

interface AssetsState {
	/** Undefined until the first answer from main. */
	status: AssetStatus | undefined;
	/** True while the last settled state was `ready`: the protocol serves files. */
	ready: boolean;
	sync(): void;
	/** Team id to the `rift-asset://` URL of its downloaded logo. */
	teamLogos: Readonly<Record<string, string>>;
	playerPhotos: Readonly<Record<string, string>>;
	leagueLogos: Readonly<Record<string, string>>;
	/** The verified champion catalog (names in ES and EN), or null without one. */
	champions: ChampionCatalog | null;
}

const AssetsContext = createContext<AssetsState | null>(null);

// Main sends progress but no "done" event: while syncing, ask again.
const pollMs = 1000;

/** Follows the asset cache; the app passes `window.riftlegends.assets`. */
export function AssetsProvider(props: { api: AssetsApi; children: ReactNode }) {
	const { api } = props;
	const [status, setStatus] = useState<AssetStatus>();
	const [ready, setReady] = useState(false);
	const [teamLogos, setTeamLogos] = useState<Record<string, string>>({});
	const [playerPhotos, setPlayerPhotos] = useState<Record<string, string>>({});
	const [leagueLogos, setLeagueLogos] = useState<Record<string, string>>({});
	const [catalog, setCatalog] = useState<{
		status: AssetStatus;
		champions: ChampionCatalog | null;
	}>();
	const champions =
		status?.state === "ready" && catalog?.status !== status
			? null
			: (catalog?.champions ?? null);
	const mounted = useRef(true);

	const settle = useCallback((next: AssetStatus) => {
		if (!mounted.current) return;
		setStatus(next);
		if (next.state !== "syncing") setReady(next.state === "ready");
	}, []);

	const refresh = useCallback(() => {
		api.status().then(settle, () => settle({ state: "error" }));
	}, [api, settle]);

	useEffect(() => {
		mounted.current = true;
		const unsubscribe = api.subscribe((progress) =>
			settle({ state: "syncing", progress }),
		);
		refresh();
		return () => {
			mounted.current = false;
			unsubscribe();
		};
	}, [api, refresh, settle]);

	useEffect(() => {
		if (status?.state !== "syncing") return;
		const timer = setTimeout(refresh, pollMs);
		return () => clearTimeout(timer);
	}, [status, refresh]);

	const sync = useCallback(() => {
		settle({ state: "syncing", progress: { completed: 0, total: 0 } });
		api.sync().then(settle, () => settle({ state: "error" }));
	}, [api, settle]);
	const readPlayerPhotos = useCallback(() => {
		api.playerPhotos().then(
			(photos) => mounted.current && setPlayerPhotos(photos),
			() => undefined,
		);
	}, [api]);

	const readTeamLogos = useCallback(() => {
		api.teamLogos().then(
			(logos) => mounted.current && setTeamLogos(logos),
			() => undefined,
		);
	}, [api]);

	// Logos download after the cache is ready: read the map again when they land.
	useEffect(() => api.subscribeTeamLogos(readTeamLogos), [api, readTeamLogos]);
	useEffect(
		() => api.subscribePlayerPhotos(readPlayerPhotos),
		[api, readPlayerPhotos],
	);

	useEffect(() => {
		let request = 0;
		const read = () => {
			const current = ++request;
			api.leagueLogos().then(
				(logos) => current === request && setLeagueLogos(logos),
				() => undefined,
			);
		};
		const unsubscribe = api.subscribeTeamLogos(read);
		read();
		return () => {
			request++;
			unsubscribe();
		};
	}, [api]);

	useEffect(() => {
		if (status?.state !== "ready") return;
		let current = true;
		readTeamLogos();
		readPlayerPhotos();
		api.champions().then(
			(champions) => current && setCatalog({ status, champions }),
			() => current && setCatalog({ status, champions: null }),
		);
		return () => {
			current = false;
		};
	}, [api, status, readTeamLogos, readPlayerPhotos]);

	const value = useMemo(
		() => ({
			status,
			ready,
			sync,
			teamLogos,
			leagueLogos,
			champions,
			playerPhotos,
		}),
		[status, ready, sync, teamLogos, leagueLogos, champions, playerPhotos],
	);
	return <AssetsContext value={value}>{props.children}</AssetsContext>;
}

/** The asset cache, or null outside an `AssetsProvider` (then there is no cache). */
export function useOptionalAssets() {
	return use(AssetsContext);
}

export function useAssets() {
	const assets = use(AssetsContext);
	if (!assets) throw new Error("useAssets needs an AssetsProvider");
	return assets;
}

/**
 * The `rift-asset://` URL of a cached file, or undefined while the cache is
 * not ready (and outside an `AssetsProvider`), so callers fall back to their
 * own art.
 */
export function useAssetSrc(source: "cdragon", path: string) {
	const assets = use(AssetsContext);
	return assets?.ready ? `rift-asset://${source}/${path}` : undefined;
}

/**
 * The `rift-asset://` URL of a team's downloaded logo, or undefined when it has
 * none (or outside an `AssetsProvider`), so callers fall back to their own crest.
 */
export function useTeamLogoSrc(teamId: string): string | undefined {
	const logos = use(AssetsContext)?.teamLogos;
	return logos && Object.hasOwn(logos, teamId) ? logos[teamId] : undefined;
}

export function usePlayerPhotoSrc(playerId: string): string | undefined {
	const photos = use(AssetsContext)?.playerPhotos;
	return photos && Object.hasOwn(photos, playerId)
		? photos[playerId]
		: undefined;
}

export function useLeagueLogoSrc(id: string): string | undefined {
	const logos = use(AssetsContext)?.leagueLogos;
	return logos && Object.hasOwn(logos, id) ? logos[id] : undefined;
}
