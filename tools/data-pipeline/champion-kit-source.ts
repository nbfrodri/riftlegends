// Champion kit facts from CommunityDragon game data (#340, plan 11): spell tags
// and cooldowns from `characters/<id>/<id>.bin.json`, crowd control and damage
// types from the official tooltips in `lol.stringtable.json`. Only facts are
// kept (tags, statuses, damage types, numbers); no tooltip text is stored.

export type SlotId = "q" | "w" | "e" | "r" | "p";
export type DamageType = "physical" | "magic" | "true";
export type Mark = "heal" | "shield" | "antiheal";

export interface KitSlot {
	/** Spell tags without the `Trait_` prefix, limited to {@link tagWhitelist}. */
	tags: string[];
	/** Normalized statuses from `<status>` tooltip markers, sorted. */
	statuses: string[];
	damage: DamageType[];
	marks: Mark[];
}

export interface ChampionKit {
	id: string;
	/** Basic attack range in game units. */
	attackRange: number;
	/** Seconds at ultimate ranks 1 to 3; null when the fourth slot is no ultimate. */
	ultCooldown: [number, number, number] | null;
	slots: Record<SlotId, KitSlot>;
}

const tagWhitelist = new Set([
	"Ultimate",
	"DamageAbility",
	"ImmobilizingCCSpell",
	"ImmobilizingCCAbility",
	"AoE",
	"Target_Area",
	"Target_Directional",
	"PlayerSelectedDashDirection",
	"Ranged_StopsFirstHit",
	"Ranged_Piercing",
	"Ranged_Zone",
	"KnockBack",
	"ProjectileDestruction",
	"Shield",
	"PassiveShield",
	"ActiveHeal",
	"SelfHeal",
]);

const slotIds = ["q", "w", "e", "r"] as const;

export const bin = (patch: string, alias: string) => {
	const folder = alias.toLowerCase();
	return `https://raw.communitydragon.org/${patch}/game/data/characters/${folder}/${folder}.bin.json`;
};

export const stringtableUrl = (patch: string) =>
	`https://raw.communitydragon.org/${patch}/game/en_us/data/menu/en_us/lol.stringtable.json`;

type Json = Record<string, unknown>;

function record(value: unknown, what: string): Json {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error(`Invalid ${what}`);
	return value as Json;
}

/** Spell tooltips by lowercase key. Accepts the raw table and the cached subset. */
export function readTooltips(body: unknown): Record<string, string> {
	const entries = record(record(body, "string table").entries, "string table");
	const tooltips: Record<string, string> = {};
	for (const [key, text] of Object.entries(entries)) {
		if (
			typeof text === "string" &&
			key.startsWith("spell_") &&
			key.endsWith("_tooltip")
		)
			tooltips[key] = text;
	}
	if (!Object.keys(tooltips).length) throw new Error("Empty spell tooltips");
	return tooltips;
}

export const tooltipsBody = (tooltips: Record<string, string>) => ({
	entries: tooltips,
});

const statusWords: readonly [RegExp, string][] = [
	[/knock\w*\s+up/, "knockup"],
	[/airborne/, "airborne"],
	[/knock\w*(\s+(back|away|aside))?$|push/, "knockback"],
	[/pull|drag/, "pull"],
	[/stun/, "stun"],
	[/root|immobili[sz]|snare/, "root"],
	[/charm/, "charm"],
	[/fear|flee/, "fear"],
	[/taunt/, "taunt"],
	[/suppress/, "suppress"],
	[/sleep|asleep|drowsy/, "sleep"],
	[/polymorph/, "polymorph"],
	[/disabl/, "disable"],
	[/silenc/, "silence"],
	[/slow/, "slow"],
	[/disarm/, "disarm"],
];

export function normalizeStatus(word: string): string | undefined {
	if (word.includes("@")) return undefined;
	const text = word.toLowerCase();
	return statusWords.find(([pattern]) => pattern.test(text))?.[1];
}

function describe(text: string) {
	const statuses = new Set<string>();
	// "<status>Knocking</status> <status>Up</status>" is one status.
	for (const [, word = ""] of text
		.replace(/(<status>knock\w*)<\/status>\s*<status>(up|back|away)</gi, "$1 $2<")
		.matchAll(/<status>(.*?)<\/status>/g)) {
		const status = normalizeStatus(word);
		if (status) statuses.add(status);
	}
	const damage = (["physical", "magic", "true"] as const).filter((type) =>
		text.includes(`<${type}Damage>`),
	);
	const marks: Mark[] = [];
	if (text.includes("<healing>")) marks.push("heal");
	if (text.includes("<shield>")) marks.push("shield");
	if (/grievous wounds/i.test(text)) marks.push("antiheal");
	return { statuses: [...statuses], damage, marks };
}

function unique<T>(values: readonly T[]) {
	return [...new Set(values)].sort();
}

export function readKit(
	id: string,
	body: unknown,
	tooltips: Readonly<Record<string, string>>,
): ChampionKit {
	const data = record(body, `kit of ${id}`);
	const byName = new Map(Object.entries(data).map(([k, v]) => [k.toLowerCase(), v]));
	const rootKey = Object.keys(data).find((key) =>
		key.endsWith("/CharacterRecords/Root"),
	);
	if (!rootKey) throw new Error(`No character record for ${id}`);
	const root = record(data[rootKey], `character record of ${id}`);
	const character = String(root.mCharacterName);
	const abilityKeys = (root.mAbilities as unknown[]).map(String);
	const names = (root.spellNames as unknown[]).map(String);
	const attackRange = Number(
		record(root.attackRangeModifiable, "attack range").baseValue,
	);
	if (!Number.isFinite(attackRange) || attackRange <= 0 || names.length < 4)
		throw new Error(`Invalid character record for ${id}`);

	const used = new Set<string>();
	const abilityOf = (slot: number) => {
		const named = `Characters/${character}/Spells/${names[slot]?.split("/")[0]}`;
		const key = byName.has(named.toLowerCase())
			? abilityKeys.find((candidate) => candidate.toLowerCase() === named.toLowerCase()) ?? named
			: undefined;
		// A slot that repeats another one (a data error) takes the next unused ability.
		return key && !used.has(key) ? key : abilityKeys.find((c) => !used.has(c));
	};
	const assigned = slotIds.map((_, slot) => {
		const key = abilityOf(slot);
		if (key) used.add(key);
		return key;
	});
	const spellsOf = (ability: string | undefined) => {
		const entry = ability ? byName.get(ability.toLowerCase()) : undefined;
		const spells = entry ? (record(entry, "ability").mChildSpells as unknown[]) : [];
		return (spells ?? []).flatMap((key) => {
			const spell = byName.get(String(key).toLowerCase());
			return spell ? [record(record(spell, "spell").mSpell ?? {}, "spell")] : [];
		});
	};
	const slotOf = (abilities: readonly (string | undefined)[]): KitSlot => {
		const texts: ReturnType<typeof describe>[] = [];
		const tags: string[] = [];
		for (const spell of abilities.flatMap(spellsOf)) {
			for (const tag of (spell.mSpellTags as unknown[] | undefined) ?? []) {
				const name = String(tag).replace(/^Trait_/, "");
				if (tagWhitelist.has(name)) tags.push(name);
			}
			const loc = (
				(spell.mClientData as Json | undefined)?.mTooltipData as Json | undefined
			)?.mLocKeys as Json | undefined;
			const text =
				typeof loc?.keyTooltip === "string"
					? tooltips[loc.keyTooltip.toLowerCase()]
					: undefined;
			if (text) texts.push(describe(text));
		}
		return {
			tags: unique(tags),
			statuses: unique(texts.flatMap((t) => t.statuses)),
			damage: unique(texts.flatMap((t) => t.damage)),
			marks: unique(texts.flatMap((t) => t.marks)),
		};
	};
	const slots = Object.fromEntries(
		slotIds.map((slot, index) => [slot, slotOf([assigned[index]])]),
	) as Record<SlotId, KitSlot>;
	slots.p = slotOf(abilityKeys.filter((key) => !used.has(key)));

	const ultimate = assigned[3];
	const rootSpell = (() => {
		const entry = ultimate ? byName.get(ultimate.toLowerCase()) : undefined;
		const key = entry ? record(entry, "ability").mRootSpell : undefined;
		const spell = typeof key === "string" ? byName.get(key.toLowerCase()) : undefined;
		return spell ? record(record(spell, "spell").mSpell ?? {}, "spell") : undefined;
	})();
	const cooldowns = (rootSpell?.cooldownTime as unknown[] | undefined)?.slice(1, 4);
	const isUltimate = ((rootSpell?.mSpellTags as unknown[] | undefined) ?? []).includes(
		"Trait_Ultimate",
	);
	const ultCooldown =
		isUltimate &&
		cooldowns?.length === 3 &&
		cooldowns.every((v) => typeof v === "number" && v > 0)
			? (cooldowns.map((v) => Math.round((v as number) * 10) / 10) as [
					number,
					number,
					number,
				])
			: null;
	return { id, attackRange, ultCooldown, slots };
}
