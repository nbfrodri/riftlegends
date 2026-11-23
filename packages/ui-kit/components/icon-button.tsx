import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import { Tooltip } from "./tooltip";

type IconButtonProps = Omit<ButtonProps, "children" | "aria-label"> & {
	/** Accessible name and tooltip text; an icon alone says nothing to a screen reader. */
	label: string;
	icon: LucideIcon;
};

/** An icon-only button: the label is its accessible name and its tooltip. */
export function IconButton({
	label,
	icon: Icon,
	variant = "ghost",
	...props
}: IconButtonProps) {
	return (
		<Tooltip content={label} side="bottom">
			<Button variant={variant} aria-label={label} {...props}>
				<Icon aria-hidden="true" className="size-5" />
			</Button>
		</Tooltip>
	);
}
