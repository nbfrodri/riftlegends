import type { AssetStatus } from "@rift-legends/contracts";
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

type AssetSource = "ddragon" | "cdragon";

interface AssetsState {
	/** Undefined until the first answer from main. */
	status: AssetStatus | undefined;
	/** True while the last settled state was `ready`: the protocol serves files. */
	ready: boolean;
	sync(): void;
}

const AssetsContext = createContext<AssetsState | null>(null);

// Main sends progress but no "done" event: while syncing, ask again.
const pollMs = 1000;

/** Follows the asset cache; the app passes `window.riftlegends.assets`. */
export function AssetsProvider(props: { api: AssetsApi; children: ReactNode }) {
	const { api } = props;
	const [status, setStatus] = useState<AssetStatus>();
	const [ready, setReady] = useState(false);
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

	const value = useMemo(() => ({ status, ready, sync }), [status, ready, sync]);
	return <AssetsContext value={value}>{props.children}</AssetsContext>;
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
export function useAssetSrc(source: AssetSource, path: string) {
	const assets = use(AssetsContext);
	return assets?.ready ? `rift-asset://${source}/${path}` : undefined;
}
