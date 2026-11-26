import { competitionStageName } from "@rift-legends/i18n";

type StageTranslate = Parameters<typeof competitionStageName>[0];
type StageNaming = Parameters<typeof competitionStageName>[1];
type NamedId = "first-stand" | "msi" | "worlds" | "rift-league";
type Translate = (key: `competition.name.${NamedId}`) => string;

// Names and dates of the season views. Leagues are named by their id; the
// international events and the fictional league have catalog names.

const named = new Set<string>(["first-stand", "msi", "worlds", "rift-league"]);
const INTERNATIONAL = new Set(["first-stand", "msi", "worlds"]);
/** First Stand, MSI and Worlds, as opposed to the leagues. */
export const isInternational = (id: string) => INTERNATIONAL.has(id);

const isNamed = (id: string): id is NamedId => named.has(id);

export const competitionName = (t: Translate, id: string): string =>
	isNamed(id) ? t(`competition.name.${id}`) : id;

/** The id of the league logo of a competition (plan 11, #387). */
const logoIds: Record<string, string> = {
	"first-stand": "First Stand",
	msi: "MSI",
	worlds: "Worlds",
};
export const competitionLogoId = (id: string) => logoIds[id] ?? id;

/** Split and stage of a stage row of `season.overview`, in the UI language. */
export function stageLabel(
	t: StageTranslate,
	row: { stage: string; name?: StageNaming | undefined },
) {
	return competitionStageName(t, row.name, stageName(row.stage));
}

/** The stage row of `season.overview` that a schedule slot belongs to. */
export function stageRowOf(
	overview:
		| {
				competitions: readonly {
					id: string;
					stages: readonly {
						stage: string;
						name?: StageNaming | undefined;
					}[];
				}[];
		  }
		| undefined,
	slot: { competition: string; stage: string },
) {
	return (
		overview?.competitions
			.find(({ id }) => id === slot.competition)
			?.stages.find(({ stage }) => stage === slot.stage) ?? {
			stage: slot.stage,
		}
	);
}

/** The same label for sentences: «Winter Split, Playoffs». */
export function stageText(
	t: StageTranslate,
	row: { stage: string; name?: StageNaming | undefined },
) {
	const { split, stage } = stageLabel(t, row);
	return split ? `${split}, ${stage}` : stage;
}

/**
 * A stage id as a title: «cup-playin-r1-1» reads «Cup playin r1 1», and a
 * hyphen between digits stays («rounds-1-2» reads «Rounds 1-2»). Formats carry
 * no stage names yet.
 */
function stageName(id: string) {
	const text = id.replace(/(?<!\d)-|-(?!\d)/g, " ");
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Day 0 is the 1st of January of the season year (plan 12, calendar). */
export function dayDate(year: number, day: number, language: string) {
	return new Intl.DateTimeFormat(language, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	}).format(new Date(Date.UTC(year, 0, 1 + day)));
}
