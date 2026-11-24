import { ROLES, type Role } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "./assets/game-role-icon";

const roleToggleClass =
	"grid size-[30px] cursor-pointer place-items-center rounded-control border border-line bg-surface text-muted outline-offset-2 hover:text-text focus-visible:outline-2 focus-visible:outline-action aria-pressed:border-action aria-pressed:bg-action/15 aria-pressed:text-text";

/** A role filter toggle with its icon, shared with the market filters. */
export function RoleToggle(props: {
	role: Role;
	label: string;
	pressed: boolean;
	onClick: () => void;
}) {
	return (
		<Tooltip content={props.label}>
			<button
				type="button"
				aria-pressed={props.pressed}
				aria-label={props.label}
				onClick={props.onClick}
				className={roleToggleClass}
			>
				<GameRoleIcon role={props.role} size={16} />
			</button>
		</Tooltip>
	);
}

/** Same look as the draft pool filters (without "all": each tier list is per role). */
const RoleFilterButtons = memo(function RoleFilterButtons(props: {
	value: Role;
	onChange: (value: Role) => void;
}) {
	const { t } = useTranslation();
	return (
		<fieldset
			aria-label={t("draft.board.roleFilter")}
			className="m-0 flex shrink-0 gap-1 border-0 p-0"
		>
			{ROLES.map((value) => {
				const label = t(`market.role.${value}`);
				return (
					<RoleToggle
						key={value}
						role={value}
						label={label}
						pressed={props.value === value}
						onClick={() => props.onChange(value)}
					/>
				);
			})}
		</fieldset>
	);
});

export function ChampionFilters(props: {
	role: Role;
	onRole: (role: Role) => void;
	/** The tier list is per role; the full list shows every role. */
	roles: boolean;
	query: string;
	onQuery: (query: string) => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex items-center gap-2">
			<input
				type="search"
				value={props.query}
				onChange={(event) => props.onQuery(event.target.value)}
				aria-label={t("draft.board.search")}
				placeholder={t("draft.board.searchPlaceholder")}
				className="min-w-0 max-w-60 flex-1 rounded-control border border-line bg-surface px-2.5 py-[5px] text-[13px] text-text placeholder:text-muted hover:border-muted focus-visible:border-action"
			/>
			{props.roles && (
				<RoleFilterButtons value={props.role} onChange={props.onRole} />
			)}
		</div>
	);
}
