import { CSPProvider } from "@base-ui/react/csp-provider";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { cn } from "../lib/utils";

/**
 * A single-thumb slider (Caja), styled as `RangeSlider`. The label names the
 * thumb; arrow keys, Page Up/Down, Home and End move it.
 */
export function Slider(props: {
	label: string;
	min: number;
	max: number;
	step?: number | undefined;
	value: number;
	onChange: (value: number) => void;
	format?: ((value: number) => string) | undefined;
	className?: string;
}) {
	const format = props.format ?? String;
	return (
		<CSPProvider disableStyleElements>
			<BaseSlider.Root
				min={props.min}
				max={props.max}
				step={props.step ?? 1}
				value={props.value}
				onValueChange={(value) => {
					if (typeof value === "number") props.onChange(value);
				}}
				className={cn("flex items-center", props.className)}
			>
				<BaseSlider.Control className="flex h-4 w-full cursor-pointer items-center px-1.5">
					<BaseSlider.Track className="relative h-1 w-full rounded-control bg-line">
						<BaseSlider.Indicator className="h-full rounded-control bg-action" />
						<BaseSlider.Thumb
							aria-label={props.label}
							getAriaValueText={(_, value) => format(value)}
							className="block size-3.5 cursor-pointer rounded-control border-2 border-action bg-text outline-offset-2 hover:bg-action focus-visible:outline-2 focus-visible:outline-action"
						/>
					</BaseSlider.Track>
				</BaseSlider.Control>
			</BaseSlider.Root>
		</CSPProvider>
	);
}
