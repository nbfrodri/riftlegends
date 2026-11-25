import {
	type DraftView,
	ROLES,
	type Role,
	type SeriesOptions,
	type Side,
} from "@rift-legends/contracts";
import { useReducedMotion } from "@rift-legends/ui-kit/lib/use-reduced-motion";
import { memo, useId } from "react";
import { teamName } from "../session";
import { DraftPickRow } from "./pick-row";
import { TeamColumnBans } from "./team-column-bans";
import { TeamColumnHeader } from "./team-column-header";

export interface PlayerRef {
	team: string;
	role: Role;
}

const SIDE = {
	blue: { letter: "B", text: "text-side-blue", border: "border-side-blue" },
	red: { letter: "R", text: "text-side-red", border: "border-side-red" },
} as const;

/**
 * A side of the draft: a fixed row per player, top to support, with the pick
 * placed in it, and its five ban slots. Clicking a row (or Enter and
 * Space) selects its player for the player card; hover and focus do not (#376).
 */
export const TeamColumn = memo(function TeamColumn(props: {
	side: Side;
	first: boolean;
	team: DraftView[Side];
	options: SeriesOptions;
	/** Index of the pick the user is choosing now, if any; it is also the row of the player who picks it. */
	current: number | null;
	/** The champion selected in the pool for that pick, shown faded until it is confirmed. */
	preview?: string | null;
	/** The role whose player the player card shows, if they are on this team. */
	selected?: Role | null;
	/** Whether this side bans now: its next ban slot is marked. */
	banning?: boolean;
	onPlayer: (player: PlayerRef) => void;
}) {
	const { options, team } = props;
	const name = teamName(options, team.team);
	const players = options.teams.find(({ id }) => id === team.team)?.players;
	const id = useId();
	const style = SIDE[props.side];
	const reduced = useReducedMotion();
	return (
		<section
			data-card-side={props.side}
			aria-labelledby={`${id}-side ${id}-team`}
			className={`flex min-h-0 flex-col border-t-[3px] bg-panel px-[15px] py-3 ${style.border}`}
		>
			<TeamColumnHeader
				id={id}
				side={props.side}
				first={props.first}
				team={team.team}
				name={name}
				sideText={style.text}
			/>
			<ol className="my-1 grid flex-1 auto-rows-fr gap-1">
				{ROLES.map((role, row) => {
					const current = row === props.current;
					const champion =
						team.picks[row] ?? (current ? props.preview : undefined);
					const slot = style.letter + (row + 1);
					// Selected in the pool but not confirmed yet (#435).
					const pending = current && !!champion && !team.picks[row];
					const handle = players?.find((p) => p.role === role)?.handle;
					return (
						<DraftPickRow
							key={role}
							role={role}
							slot={slot}
							champion={champion}
							handle={handle}
							current={current}
							pending={pending}
							selected={props.selected === role}
							sideText={style.text}
							reduced={reduced}
							options={options}
							onSelect={() => props.onPlayer({ team: team.team, role })}
						/>
					);
				})}
			</ol>
			<TeamColumnBans
				id={id}
				bans={team.bans}
				options={options}
				banning={props.banning === true}
				preview={props.preview ?? null}
				sideText={style.text}
				sideBorder={style.border}
				reduced={reduced}
			/>
		</section>
	);
});
