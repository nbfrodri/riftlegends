import type { AssetStatus } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import {
	CircleAlert,
	CircleCheck,
	CloudOff,
	Download,
	LoaderCircle,
	type LucideIcon,
	RotateCw,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useAssets } from ".";

type State = AssetStatus["state"] | "checking";

const looks: Record<State, { icon: LucideIcon; tone: string }> = {
	checking: { icon: LoaderCircle, tone: "text-muted motion-safe:animate-spin" },
	missing: { icon: CloudOff, tone: "text-muted" },
	syncing: { icon: LoaderCircle, tone: "text-action motion-safe:animate-spin" },
	ready: { icon: CircleCheck, tone: "text-action" },
	error: { icon: CircleAlert, tone: "text-side-red" },
};

const actions: Record<
	State,
	{ label: "download" | "retry" | "update"; icon: LucideIcon }
> = {
	checking: { label: "download", icon: Download },
	missing: { label: "download", icon: Download },
	syncing: { label: "download", icon: Download },
	ready: { label: "update", icon: RotateCw },
	error: { label: "retry", icon: RotateCw },
};

export function Progress({
	completed,
	total,
}: {
	completed: number;
	total: number;
}) {
	const { t } = useTranslation();
	const known = total > 0;
	return (
		<div className="mt-3">
			<div
				role="progressbar"
				aria-label={t("settings.content.progress")}
				aria-valuemin={0}
				aria-valuemax={known ? total : undefined}
				aria-valuenow={known ? completed : undefined}
				className="h-1.5 overflow-hidden rounded-control bg-line"
			>
				<div
					className="h-full bg-action transition-[width] duration-300 ease-lock motion-reduce:transition-none"
					style={{ width: known ? `${(completed / total) * 100}%` : "25%" }}
				/>
			</div>
			<p className="mt-1.5 text-[13px] text-muted tabular-nums">
				{known
					? t("settings.content.files", { completed, total })
					: t("settings.content.preparing")}
			</p>
		</div>
	);
}

/** Settings, «Contenido»: state of the official content cache (plan 10, U3). */
export function ContentSettings() {
	const { t } = useTranslation();
	const { status, sync } = useAssets();
	const titleId = useId();
	const state: State = status?.state ?? "checking";
	const { icon: Icon, tone } = looks[state];
	const action = actions[state];
	const busy = state === "syncing" || state === "checking";
	const urgent = state === "missing" || state === "error";

	return (
		<section
			aria-labelledby={titleId}
			className="mx-[clamp(14px,1.35vw,28px)] mt-[clamp(14px,2.1vh,24px)] max-w-[640px] bg-panel px-[clamp(12px,1.15vw,18px)] py-[clamp(10px,1.5vh,16px)]"
		>
			<h2
				id={titleId}
				className="font-bold font-display text-[clamp(16px,1.45vw,23px)] leading-[1.1] tracking-[-0.045em]"
			>
				{t("settings.content.title")}
			</h2>
			<p className="mt-1 text-muted">{t("settings.content.description")}</p>
			<div className="mt-3 flex items-center gap-3">
				<Icon size={20} aria-hidden="true" className={`shrink-0 ${tone}`} />
				<p aria-live="polite" className="min-w-0 flex-1">
					{status?.state === "ready"
						? t("settings.content.ready", { version: status.version })
						: t(`settings.content.${state}`)}
				</p>
				<Button
					variant={urgent ? "default" : "ghost"}
					disabled={busy}
					onClick={sync}
				>
					<action.icon size={16} aria-hidden="true" />
					{t(`settings.content.${action.label}`)}
				</Button>
			</div>
			{status?.state === "syncing" && <Progress {...status.progress} />}
		</section>
	);
}
