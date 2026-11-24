import { CSPProvider } from "@base-ui/react/csp-provider";
import { Slider } from "@base-ui/react/slider";
import { useId } from "react";
import { cn } from "../lib/utils";

/**
 * A range with two thumbs (Caja): the label and the chosen range as text on
 * top, the track below. Arrow keys, Page Up/Down, Home and End move the
 * focused thumb; each thumb has its own name and reads its value as text.
 */
export function RangeSlider(props: {
	label: string;
	minLabel: string;
	maxLabel: string;
	min: number;
	max: number;
	step?: number | undefined;
	value: readonly [number, number];
	onChange: (value: [number, number]) => void;
	format?: ((value: number) => string) | undefined;
	className?: string;
}) {
	const id = useId();
	const format = props.format ?? String;
	const [low, high] = props.value;
	const thumb =
		"block size-3.5 cursor-pointer rounded-control border-2 border-action bg-text outline-offset-2 hover:bg-action focus-visible:outline-2 focus-visible:outline-action";
	return (
		<CSPProvider disableStyleElements>
			<Slider.Root
				aria-labelledby={id}
				min={props.min}
				max={props.max}
				step={props.step ?? 1}
				value={[low, high]}
				onValueChange={(value) => {
					const [a, b] = value as number[];
					if (a !== undefined && b !== undefined) props.onChange([a, b]);
				}}
				className={cn("flex flex-col gap-1.5", props.className)}
			>
				<div className="flex items-baseline justify-between gap-2">
					<span id={id} className="text-muted">
						{props.label}
					</span>
					<span className="text-text tabular-nums">
						{`${format(low)} – ${format(high)}`}
					</span>
				</div>
				<Slider.Control className="flex h-4 cursor-pointer items-center px-1.5">
					<Slider.Track className="relative h-1 w-full rounded-control bg-line">
						<Slider.Indicator className="h-full rounded-control bg-action" />
						<Slider.Thumb
							index={0}
							aria-label={props.minLabel}
							getAriaValueText={(_, value) => format(value)}
							className={thumb}
						/>
						<Slider.Thumb
							index={1}
							aria-label={props.maxLabel}
							getAriaValueText={(_, value) => format(value)}
							className={thumb}
						/>
					</Slider.Track>
				</Slider.Control>
			</Slider.Root>
		</CSPProvider>
	);
}
