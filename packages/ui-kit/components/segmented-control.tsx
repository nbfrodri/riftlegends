import { type ReactNode, useId } from "react";
import { cn } from "../lib/utils";

interface SegmentedControlProps<Value extends string> {
	/** Accessible name of the group. */
	label: string;
	options: readonly { value: Value; label: ReactNode; disabled?: boolean }[];
	value: Value;
	onChange: (value: Value) => void;
	className?: string;
}

/**
 * A few mutually exclusive choices side by side (Caja segments); the checked
 * one is filled, never underlined (#376). Native radios
 * underneath, so arrow keys, focus and screen readers behave as expected.
 */
export function SegmentedControl<Value extends string>({
	label,
	options,
	value,
	onChange,
	className,
}: SegmentedControlProps<Value>) {
	const name = useId();
	return (
		<div
			role="radiogroup"
			aria-label={label}
			data-slot="segmented-control"
			className={cn("inline-flex", className)}
		>
			{options.map((option, index) => (
				<label
					key={option.value}
					className={cn(
						"relative",
						option.disabled ? "cursor-default" : "press cursor-pointer",
					)}
				>
					<input
						type="radio"
						name={name}
						value={option.value}
						checked={option.value === value}
						disabled={option.disabled}
						onChange={() => onChange(option.value)}
						className="peer absolute size-px opacity-0"
					/>
					<span
						className={cn(
							"block min-w-12 border border-line px-3 py-[5px] text-center text-text peer-not-checked:hover:bg-surface peer-disabled:text-muted peer-disabled:hover:bg-transparent peer-checked:border-action peer-checked:bg-action peer-checked:font-bold peer-checked:text-on-action peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action",
							index > 0 && "border-l-0",
						)}
					>
						{option.label}
					</span>
				</label>
			))}
		</div>
	);
}
