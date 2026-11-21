import { type ReactNode, useId } from "react";
import { cn } from "../lib/utils";

interface SegmentedControlProps<Value extends string> {
	/** Accessible name of the group. */
	label: string;
	options: readonly { value: Value; label: ReactNode }[];
	value: Value;
	onChange: (value: Value) => void;
	className?: string;
}

/**
 * A few mutually exclusive choices side by side (Caja segments). Native radios
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
				<label key={option.value} className="relative cursor-pointer">
					<input
						type="radio"
						name={name}
						value={option.value}
						checked={option.value === value}
						onChange={() => onChange(option.value)}
						className="peer absolute size-px opacity-0"
					/>
					<span
						className={cn(
							"block min-w-12 border border-line px-3 py-[5px] text-center text-text hover:bg-surface peer-checked:bg-surface peer-checked:font-bold peer-checked:text-action peer-checked:shadow-[inset_0_-2px_var(--color-action)] peer-focus-visible:outline-2 peer-focus-visible:outline-action",
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
