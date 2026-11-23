import { Combobox } from "@base-ui/react/combobox";
import { CSPProvider } from "@base-ui/react/csp-provider";
import { Check, ChevronDown, Search } from "lucide-react";
import type { ReactNode } from "react";
import { withState } from "../lib/utils";

export interface SearchSelectItem {
	value: string;
	/** What the trigger shows and the search matches. */
	label: string;
	/** Secondary text after the label, in the list only. */
	detail?: ReactNode;
}

export interface SearchSelectGroup {
	/** Heading of the group; a group without one shows no heading. */
	label?: string;
	items: SearchSelectItem[];
}

/**
 * A select for long lists: its popup has a search box on top and the items
 * under group headings (Caja style, like `Select`).
 */
export function SearchSelect(props: {
	/** Accessible name of the trigger. */
	label: string;
	/** Accessible name and placeholder of the search box. */
	searchLabel: string;
	/** Shown when the search matches nothing. */
	empty: string;
	groups: readonly SearchSelectGroup[];
	value: string;
	onChange: (value: string) => void;
	className?: string;
}) {
	const selected =
		props.groups
			.flatMap((group) => group.items)
			.find((item) => item.value === props.value) ?? null;
	return (
		<Combobox.Root
			items={props.groups}
			value={selected}
			onValueChange={(item: SearchSelectItem | null) =>
				item && props.onChange(item.value)
			}
			isItemEqualToValue={(a: SearchSelectItem, b: SearchSelectItem) =>
				a.value === b.value
			}
		>
			<Combobox.Trigger
				aria-label={props.label}
				className={withState(
					"inline-flex min-w-0 items-center justify-between gap-2 whitespace-nowrap rounded-control border border-line bg-surface px-2 py-[5px] text-text select-none hover:not-data-disabled:border-muted data-popup-open:border-action data-disabled:cursor-default data-disabled:text-muted",
					props.className,
				)}
			>
				<span className="truncate">
					<Combobox.Value />
				</span>
				<ChevronDown
					aria-hidden="true"
					className="size-4 shrink-0 text-muted"
				/>
			</Combobox.Trigger>
			{/* The renderer CSP (style-src 'self') blocks the <style> Base UI would inject. */}
			<CSPProvider disableStyleElements>
				<Combobox.Portal>
					<Combobox.Positioner
						side="bottom"
						align="start"
						sideOffset={4}
						className="z-50"
					>
						<Combobox.Popup
							aria-label={props.label}
							className="flex max-h-[min(26rem,var(--available-height))] w-[max(var(--anchor-width),18rem)] flex-col rounded-control border border-line bg-panel text-text transition-opacity duration-100 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none"
						>
							<div className="flex items-center gap-2 border-line border-b px-2">
								<Search
									aria-hidden="true"
									className="size-4 shrink-0 text-muted"
								/>
								<Combobox.Input
									aria-label={props.searchLabel}
									placeholder={props.searchLabel}
									className="h-8 w-full min-w-0 bg-transparent text-text outline-none placeholder:text-muted"
								/>
							</div>
							<Combobox.Empty className="px-2 py-3 text-muted empty:hidden">
								{props.empty}
							</Combobox.Empty>
							<Combobox.List className="min-h-0 overflow-y-auto overscroll-contain py-1 empty:p-0">
								{(group: SearchSelectGroup) => (
									<Combobox.Group
										key={group.label ?? ""}
										items={group.items}
										className="pb-1 last:pb-0"
									>
										{group.label && (
											<Combobox.GroupLabel className="px-2 pt-2 pb-1 font-semibold text-[12px] text-muted uppercase tracking-[0.055em] select-none">
												{group.label}
											</Combobox.GroupLabel>
										)}
										<Combobox.Collection>
											{(item: SearchSelectItem) => (
												<Combobox.Item
													key={item.value}
													value={item}
													className="flex cursor-default items-center justify-between gap-3 px-2 py-[5px] outline-none select-none data-highlighted:bg-surface data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-solid data-highlighted:outline-action data-selected:font-semibold"
												>
													<span className="truncate">{item.label}</span>
													<span className="flex shrink-0 items-center gap-2 text-[13px] text-muted">
														{item.detail}
														<Combobox.ItemIndicator className="flex">
															<Check
																aria-hidden="true"
																className="size-4 shrink-0 text-action"
															/>
														</Combobox.ItemIndicator>
													</span>
												</Combobox.Item>
											)}
										</Combobox.Collection>
									</Combobox.Group>
								)}
							</Combobox.List>
						</Combobox.Popup>
					</Combobox.Positioner>
				</Combobox.Portal>
			</CSPProvider>
		</Combobox.Root>
	);
}
