import { ROLES, type Role } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "./assets/game-role-icon";

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
					<Tooltip key={value} content={label}>
						<button
							type="button"
							aria-pressed={props.value === value}
							aria-label={label}
							onClick={() => props.onChange(value)}
							className="grid size-[30px] place-items-center rounded-control border border-line bg-surface text-muted outline-offset-2 hover:text-text focus-visible:outline-2 focus-visible:outline-action aria-pressed:border-action aria-pressed:bg-action/15 aria-pressed:text-text"
						>
							<GameRoleIcon role={value} size={16} />
						</button>
					</Tooltip>
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
