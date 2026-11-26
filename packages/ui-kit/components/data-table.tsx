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
// a prop, so the app owns the translations. Only the rows near the viewport are
// mounted (spike S2: 500 rows plain miss the frame budget); the active row is
// always mounted and hidden spacer rows keep every row at its real offset.
// Column widths are fixed (#578): with automatic layout they would follow the
// rows mounted at each moment and jump while scrolling. Text that does not fit
// is cut with an ellipsis and read whole in the Caja tooltip.

export type DataTableColumn<Row extends RowData> = {
	id: string;
	header: string;
	/** Raw value: what sorting and the text filter read. */
	value: (row: Row) => string | number;
	/** What the cell shows; defaults to the raw value. */
	cell?: (row: Row) => ReactNode;
	/** Right-aligned tabular figures, for amounts and counts. */
	numeric?: boolean;
	/**
	 * Fixed CSS width, such as "6rem". Columns without one share what is left,
	 * so give one to every column but those that should stretch.
	 */
	width?: string;
};

/**
 * Text in a cell next to an icon: it shrinks and is cut with an ellipsis, and
 * the cell shows it whole in the tooltip when it does not fit.
 */
export function CellText({ children }: { children: ReactNode }) {
	return (
		<span data-cell-text className="min-w-0 truncate">
			{children}
		</span>
	);
}

// The tooltip carries the whole text only while something in the cell is cut.
const syncCutText = (row: HTMLTableRowElement) => {
	for (const cell of row.cells) {
		const cut = [
			...cell.querySelectorAll<HTMLElement>("[data-cell-text]"),
			cell,
		].find((element) => element.scrollWidth > element.clientWidth);
		const text = cut?.textContent;
		if (text && cell.dataset.tooltip !== text) cell.dataset.tooltip = text;
		else if (!text && cell.dataset.tooltip !== undefined)
			delete cell.dataset.tooltip;
	}
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
	/** Makes rows open something on click, Enter or Space. */
	onRowActivate?: (row: Row) => void;
	/** What activating a row does, read after the row by screen readers. */
	rowActionLabel?: (row: Row) => string;
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

const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_HEAD_HEIGHT = 32;
const OVERSCAN = 8;

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
	onRowActivate,
	rowActionLabel,
}: DataTableProps<Row>) {
	const filterId = useId();
	const [activeId, setActiveId] = useState<string>();
	const rowElements = useRef(new Map<string, HTMLTableRowElement>());
	const pendingFocus = useRef<string | undefined>(undefined);

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

	const [viewport, setViewport] = useState<HTMLElement | null>(null);
	const [head, setHead] = useState<HTMLElement | null>(null);
	// Rows start below the sticky header, which is part of the scrolled content.
	const headHeight = head?.offsetHeight ?? DEFAULT_HEAD_HEIGHT;
	const pinnedIndex = rows.findIndex((row) => row.id === tabStopId);
	const pinnedRef = useRef(pinnedIndex);
	pinnedRef.current = pinnedIndex;
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => viewport,
		estimateSize: () => DEFAULT_ROW_HEIGHT,
		overscan: OVERSCAN,
		scrollMargin: headHeight,
		getItemKey: (index) => rows[index]?.id ?? index,
		// The active row is the tab stop: without it mounted, Tab could not
		// enter the table once it scrolled out of the window.
		rangeExtractor: (range) => {
			const indexes = new Set(defaultRangeExtractor(range));
			if (pinnedRef.current >= 0) indexes.add(pinnedRef.current);
			return [...indexes].sort((a, b) => a - b);
		},
	});
	const windowed = virtualizer.getVirtualItems().flatMap((item) => {
		const row = rows[item.index];
		return row
			? [{ row, index: item.index, start: item.start, size: item.size }]
			: [];
	});

	// A row that was not mounted when asked to take focus gets it as soon as the
	// window mounts it.
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
		// Make it the active row so the window mounts it, then focus it.
		pendingFocus.current = id;
		setActiveId(id);
	};

	const onRowKeyDown = (event: KeyboardEvent, index: number) => {
		const row = rows[index];
		if (onRowActivate && row && (event.key === "Enter" || event.key === " ")) {
			event.preventDefault();
			onRowActivate(row.original);
			return;
		}
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

	const last = windowed[windowed.length - 1];
	const endGap = last
		? virtualizer.getTotalSize() + headHeight - (last.start + last.size)
		: 0;

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
					// #471: the overlay bar keeps a grid gap from the rows.
					className: "scroll-pt-8 pr-4",
				}}
			>
				<table
					aria-label={label}
					aria-rowcount={rows.length + 1}
					className="w-full table-fixed border-separate border-spacing-0 whitespace-nowrap text-table"
				>
					<colgroup>
						{columns.map((column) => (
							<col
								key={column.id}
								style={column.width ? { width: column.width } : undefined}
							/>
						))}
					</colgroup>
					<thead ref={setHead}>
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
												"sticky top-0 z-10 h-8 truncate border-line border-b bg-surface px-2.5 font-semibold last:pe-3.5",
												cellAlign(column.id),
											)}
										>
											<button
												type="button"
												onClick={column.getToggleSortingHandler()}
												className={cn(
													"inline-flex w-full cursor-pointer items-center gap-1 font-[inherit]",
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
						{windowed.flatMap(({ row, index, start }, position) => {
							const isTabStop = row.id === tabStopId;
							// Row offsets are measured from the scroll origin, so the gap
							// before a row is its start minus where the previous one ended.
							const previous = windowed[position - 1];
							const gap =
								start -
								(previous ? previous.start + previous.size : headHeight);
							return [
								gap > 0.5 && (
									<tr key={`gap-${row.id}`} aria-hidden style={{ height: gap }}>
										<td colSpan={columns.length} className="p-0" />
									</tr>
								),
								<tr
									key={row.id}
									ref={(element) => {
										if (element) {
											rowElements.current.set(row.id, element);
											virtualizer.measureElement(element);
											syncCutText(element);
										} else rowElements.current.delete(row.id);
									}}
									data-index={index}
									aria-rowindex={index + 2}
									data-row-id={row.id}
									tabIndex={isTabStop ? 0 : -1}
									data-active={isTabStop}
									data-odd={index % 2 === 1}
									aria-description={rowActionLabel?.(row.original)}
									onFocus={() => setActiveId(row.id)}
									onKeyDown={(event) => onRowKeyDown(event, index)}
									onClick={onRowActivate && (() => onRowActivate(row.original))}
									// Two-tone rows by index (the window moves, positions do not
									// hold). The darker tone is a plain class so hover and the
									// active row, both variants, still win over it.
									className={cn(
										"h-[clamp(24px,3vh,30px)] hover:bg-surface focus-visible:outline-3 focus-visible:outline-action focus-visible:-outline-offset-3 data-[active=true]:bg-surface data-[active=true]:[&>td:first-child]:shadow-[inset_3px_0_var(--color-action)]",
										index % 2 === 1 && "bg-canvas/50",
										onRowActivate && "cursor-pointer",
									)}
								>
									{row.getAllCells().map((cell) => (
										<td
											key={cell.id}
											className={cn(
												"truncate px-2.5 last:pe-3.5",
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
							];
						})}
						{windowed.length > 0 && (
							<tr aria-hidden style={{ height: endGap }}>
								<td colSpan={columns.length} className="p-0" />
							</tr>
						)}
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
