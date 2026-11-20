import {
	type ColumnDef,
	columnFilteringFeature,
	createFilteredRowModel,
	createSortedRowModel,
	flexRender,
	globalFilteringFeature,
	type RowData,
	rowSortingFeature,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
	type KeyboardEvent,
	type ReactNode,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "../lib/utils";
import { ScrollArea } from "./scroll-area";

// Dense Caja table: click or Enter/Space on a header sorts, the filter box
// narrows rows by text, and Arrow Up/Down, Home and End move between rows with
// a roving tabindex (one tab stop for the whole body). Every visible string is
// a prop, so the app owns the translations. Not virtualised: spike S2 decides.

export type DataTableColumn<Row extends RowData> = {
	id: string;
	header: string;
	/** Raw value: what sorting and the text filter read. */
	value: (row: Row) => string | number;
	/** What the cell shows; defaults to the raw value. */
	cell?: (row: Row) => ReactNode;
	/** Right-aligned tabular figures, for amounts and counts. */
	numeric?: boolean;
};

export type DataTableProps<Row extends RowData> = {
	/** Names the table and its scrolling region. */
	label: string;
	data: readonly Row[];
	columns: readonly DataTableColumn<Row>[];
	getRowId: (row: Row) => string;
	filterLabel: string;
	filterPlaceholder: string;
	emptyText: string;
	/** Result count for the status line, announced while filtering. */
	countLabel: (shown: number, total: number) => string;
	/** Locale for text sorting; defaults to the runtime's. */
	locale?: string;
	className?: string;
	/** SPIKE S2: window the rows with TanStack Virtual. */
	virtualize?: boolean;
};

const features = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	rowSortingFeature,
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
});

// Case- and accent-insensitive, so "onix" finds "Ónix".
const fold = (text: string) =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

const ariaSort = {
	asc: "ascending",
	desc: "descending",
} as const;

export function DataTable<Row extends RowData>({
	label,
	data,
	columns,
	getRowId,
	filterLabel,
	filterPlaceholder,
	emptyText,
	countLabel,
	locale,
	className,
	virtualize = false,
}: DataTableProps<Row>) {
	const filterId = useId();
	const [activeId, setActiveId] = useState<string>();
	const rowElements = useRef(new Map<string, HTMLTableRowElement>());

	const columnDefs = useMemo(() => {
		const collator = new Intl.Collator(locale);
		return columns.map(
			(column): ColumnDef<typeof features, Row> => ({
				id: column.id,
				header: column.header,
				accessorFn: column.value,
				cell: ({ row }) =>
					column.cell ? column.cell(row.original) : column.value(row.original),
				sortDescFirst: false,
				sortFn: (a, b, id) => {
					const [x, y] = [a.getValue(id), b.getValue(id)];
					return typeof x === "number" && typeof y === "number"
						? x - y
						: collator.compare(String(x), String(y));
				},
			}),
		);
	}, [columns, locale]);

	const table = useTable({
		features,
		columns: columnDefs,
		data,
		getRowId,
		enableMultiSort: false,
		globalFilterFn: (row, columnId, filter) =>
			fold(String(row.getValue(columnId))).includes(fold(String(filter))),
	});

	const rows = table.getRowModel().rows;
	const numeric = new Set(columns.filter((c) => c.numeric).map((c) => c.id));
	// The tab stop falls back to the first row when the active one is filtered out.
	const tabStopId = rows.some((row) => row.id === activeId)
		? activeId
		: rows[0]?.id;

	// SPIKE S2: virtual window. The active row is always mounted (it is the
	// roving tab stop), even when it is far outside the window, and spacer rows
	// keep every mounted row at its real offset.
	const [viewport, setViewport] = useState<HTMLElement | null>(null);
	const [headElement, setHeadElement] = useState<HTMLElement | null>(null);
	const headHeight = headElement?.offsetHeight ?? 32;
	const pinnedIndex = rows.findIndex((row) => row.id === tabStopId);
	const pinnedRef = useRef(pinnedIndex);
	pinnedRef.current = pinnedIndex;
	const pendingFocus = useRef<string | undefined>(undefined);
	const virtualizer = useVirtualizer({
		count: virtualize ? rows.length : 0,
		getScrollElement: () => viewport,
		estimateSize: () => 24,
		overscan: 8,
		scrollMargin: headHeight,
		getItemKey: (index) => rows[index]?.id ?? index,
		rangeExtractor: (range) => {
			const indexes = new Set(defaultRangeExtractor(range));
			if (pinnedRef.current >= 0) indexes.add(pinnedRef.current);
			return [...indexes].sort((a, b) => a - b);
		},
	});
	const virtualItems = virtualize ? virtualizer.getVirtualItems() : [];
	const windowed = virtualize
		? virtualItems.map((item) => ({
				row: rows[item.index],
				index: item.index,
				start: item.start,
				size: item.size,
			}))
		: rows.map((row, index) => ({ row, index, start: 0, size: 0 }));

	useLayoutEffect(() => {
		const id = pendingFocus.current;
		if (id === undefined) return;
		const element = rowElements.current.get(id);
		if (!element) return;
		pendingFocus.current = undefined;
		element.focus();
	});

	const focusRow = (id: string) => {
		const element = rowElements.current.get(id);
		if (element) {
			element.focus();
			return;
		}
		// Not mounted: make it the active row so the window mounts it, then focus.
		pendingFocus.current = id;
		setActiveId(id);
	};

	const onRowKeyDown = (event: KeyboardEvent, index: number) => {
		const target = {
			ArrowDown: Math.min(index + 1, rows.length - 1),
			ArrowUp: Math.max(index - 1, 0),
			Home: 0,
			End: rows.length - 1,
		}[event.key];
		if (target === undefined) return;
		event.preventDefault();
		const id = rows[target]?.id;
		if (id !== undefined) focusRow(id);
	};

	const cellAlign = (id: string) =>
		numeric.has(id) ? "text-right tabular-nums" : "text-left";

	return (
		<section className={cn("flex min-h-0 flex-col bg-panel", className)}>
			<div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-3.5 py-2.5 text-table">
				<label htmlFor={filterId} className="flex items-center gap-2">
					<span className="text-muted">{filterLabel}</span>
					<input
						id={filterId}
						type="search"
						value={String(table.state.globalFilter ?? "")}
						placeholder={filterPlaceholder}
						onChange={(event) => table.setGlobalFilter(event.target.value)}
						className="h-7 w-52 rounded-control border border-line bg-surface px-2 text-text placeholder:text-muted"
					/>
				</label>
				<span role="status" className="ml-auto text-[13px] text-muted">
					{countLabel(rows.length, data.length)}
				</span>
			</div>
			<ScrollArea
				className="flex-1"
				viewportProps={{
					ref: setViewport,
					role: "region",
					"aria-label": label,
					className: "scroll-pt-8",
				}}
			>
				<table
					aria-label={label}
					aria-rowcount={virtualize ? rows.length + 1 : undefined}
					className="w-full border-separate border-spacing-0 whitespace-nowrap text-table"
				>
					<thead ref={setHeadElement}>
						{table.getHeaderGroups().map((group) => (
							<tr key={group.id}>
								{group.headers.map(({ column }) => {
									const sorted = column.getIsSorted();
									return (
										<th
											key={column.id}
											scope="col"
											aria-sort={sorted ? ariaSort[sorted] : undefined}
											className={cn(
												"sticky top-0 z-10 h-8 border-line border-b bg-surface px-2.5 font-semibold last:pe-3.5",
												cellAlign(column.id),
											)}
										>
											<button
												type="button"
												onClick={column.getToggleSortingHandler()}
												className={cn(
													"inline-flex w-full items-center gap-1 font-[inherit]",
													numeric.has(column.id) && "justify-end",
												)}
											>
												{column.columnDef.header as string}
												{sorted === "asc" && (
													<ArrowUp aria-hidden className="size-3" />
												)}
												{sorted === "desc" && (
													<ArrowDown aria-hidden className="size-3" />
												)}
											</button>
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody>
						{(() => {
							const out: ReactNode[] = [];
							let cursor = virtualizer.options.scrollMargin;
							const spacer = (key: string, height: number) =>
								height > 0.5 && (
									<tr key={key} aria-hidden style={{ height }}>
										<td colSpan={columns.length} className="p-0" />
									</tr>
								);
							for (const { row, index, start, size } of windowed) {
								if (!row) continue;
								if (virtualize) {
									out.push(spacer(`gap-${row.id}`, start - cursor));
									cursor = start + size;
								}
								const isTabStop = row.id === tabStopId;
								out.push(
									<tr
										key={row.id}
										ref={(element) => {
											if (element) {
												rowElements.current.set(row.id, element);
												if (virtualize) virtualizer.measureElement(element);
											} else rowElements.current.delete(row.id);
										}}
										data-index={index}
										aria-rowindex={virtualize ? index + 2 : undefined}
										data-row-id={row.id}
										tabIndex={isTabStop ? 0 : -1}
										data-active={isTabStop}
										data-fifth={(index + 1) % 5 === 0}
										onFocus={() => setActiveId(row.id)}
										onKeyDown={(event) => onRowKeyDown(event, index)}
										className="h-[clamp(24px,3vh,30px)] hover:bg-surface focus-visible:outline-3 focus-visible:outline-action focus-visible:-outline-offset-3 data-[active=true]:bg-surface data-[active=true]:[&>td:first-child]:shadow-[inset_3px_0_var(--color-action)] data-[fifth=true]:[&>td]:border-line data-[fifth=true]:[&>td]:border-b"
									>
										{row.getAllCells().map((cell) => (
											<td
												key={cell.id}
												className={cn(
													"px-2.5 last:pe-3.5",
													cellAlign(cell.column.id),
												)}
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</td>
										))}
									</tr>,
								);
							}
							if (virtualize && windowed.length > 0) {
								out.push(
									spacer(
										"gap-end",
										virtualizer.getTotalSize() -
											(cursor - virtualizer.options.scrollMargin),
									),
								);
							}
							return out;
						})()}
						{rows.length === 0 && (
							<tr>
								<td
									colSpan={columns.length}
									className="px-3.5 py-6 text-left text-muted"
								>
									{emptyText}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</ScrollArea>
		</section>
	);
}
