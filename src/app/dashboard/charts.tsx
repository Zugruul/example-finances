'use client';

import { useEffect, useRef, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/money';

/**
 * Income-vs-expense bar chart for the last N months. Two bars per
 * month (income green, expense red) side-by-side; numbers are in
 * minor units (cents) and formatted via formatMoney in the tooltip.
 */
export function IncomeExpenseBar({
    data,
    currency,
}: {
    data: Array<{ label: string; income: number; expense: number }>;
    currency: string;
}) {
    const fmt = (v: number) => formatMoney(v, currency);
    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        className="stroke-muted"
                    />
                    <XAxis
                        dataKey="label"
                        className="text-xs"
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        className="text-xs"
                        tickFormatter={(v) =>
                            v >= 1_000_00
                                ? `${Math.round(v / 100_00)}k`
                                : v >= 100
                                  ? `${Math.round(v / 100)}`
                                  : `${v}`
                        }
                        tickLine={false}
                        axisLine={false}
                        width={40}
                    />
                    <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                        formatter={(v) =>
                            fmt(typeof v === 'number' ? v : Number(v))
                        }
                        contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                        }}
                    />
                    <Legend
                        verticalAlign="top"
                        height={24}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '0.75rem' }}
                    />
                    <Bar
                        dataKey="income"
                        fill="hsl(142 71% 45%)"
                        radius={[4, 4, 0, 0]}
                        name="Income"
                    />
                    <Bar
                        dataKey="expense"
                        fill="hsl(0 70% 55%)"
                        radius={[4, 4, 0, 0]}
                        name="Expense"
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Donut for current-month spending by category. `data` is sorted
 * descending by value; categories beyond `maxSlices` get grouped into
 * an "Other" slice so the legend stays scannable.
 *
 * Color palette is procedural (hue rotation) so categories get
 * deterministic-but-distinct fills without us hard-coding a palette.
 */
export function SpendingDonut({
    data,
    currency,
    maxSlices = 7,
}: {
    data: Array<{ name: string; value: number }>;
    currency: string;
    maxSlices?: number;
}) {
    const sorted = [...data]
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, maxSlices);
    const tail = sorted.slice(maxSlices);
    const tailSum = tail.reduce((s, d) => s + d.value, 0);
    const series =
        tailSum > 0
            ? [...head, { name: `Other (${tail.length})`, value: tailSum }]
            : head;

    const fmt = (v: number) => formatMoney(v, currency);
    const total = series.reduce((s, d) => s + d.value, 0);

    if (series.length === 0 || total === 0) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No spending this month yet.
            </div>
        );
    }

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={series}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        strokeWidth={1}
                    >
                        {series.map((entry, idx) => (
                            <Cell
                                key={entry.name}
                                fill={hueColor(idx, series.length)}
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(v, name) => [
                            fmt(typeof v === 'number' ? v : Number(v)),
                            String(name),
                        ]}
                        contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                        }}
                    />
                    <Legend
                        verticalAlign="middle"
                        align="right"
                        layout="vertical"
                        iconType="circle"
                        wrapperStyle={{
                            fontSize: '0.75rem',
                            maxWidth: '45%',
                            lineHeight: '1.5',
                        }}
                        formatter={(value: string, _entry, idx) => {
                            const slice = series[idx]!;
                            const pct = Math.round(
                                (slice.value / total) * 100,
                            );
                            return `${value} · ${pct}%`;
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Deterministic hue rotation across an n-slice donut. */
function hueColor(i: number, n: number): string {
    const hue = Math.round((360 * i) / Math.max(n, 1));
    return `hsl(${hue} 65% 55%)`;
}

/**
 * Net-worth line for the past N months. Each point is a (label,
 * balance) tuple in account currency's minor units (cents). Uses an
 * area chart with a soft fill so the up/down trend reads at a glance
 * — Empower / Lunch Money style.
 */
export function NetWorthLine({
    data,
    currency,
}: {
    data: Array<{ label: string; balance: number }>;
    currency: string;
}) {
    const fmt = (v: number) => formatMoney(v, currency);
    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                    <defs>
                        <linearGradient
                            id="netWorthFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor="hsl(217 91% 60%)"
                                stopOpacity={0.45}
                            />
                            <stop
                                offset="100%"
                                stopColor="hsl(217 91% 60%)"
                                stopOpacity={0.0}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        className="stroke-muted"
                    />
                    <XAxis
                        dataKey="label"
                        className="text-xs"
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        className="text-xs"
                        tickFormatter={(v) =>
                            v >= 1_000_00
                                ? `${Math.round(v / 100_00)}k`
                                : v >= 100
                                  ? `${Math.round(v / 100)}`
                                  : `${v}`
                        }
                        tickLine={false}
                        axisLine={false}
                        width={48}
                    />
                    <Tooltip
                        formatter={(v) =>
                            fmt(typeof v === 'number' ? v : Number(v))
                        }
                        contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="hsl(217 91% 60%)"
                        strokeWidth={2}
                        fill="url(#netWorthFill)"
                        name="Net worth"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Sparkline — minimal line, no axes or grid. Used inside small
 * cards (per-account balance trends, per-category last-6-mo).
 */
export function Sparkline({
    data,
    stroke = 'hsl(217 91% 60%)',
}: {
    data: Array<{ x: number | string; y: number }>;
    stroke?: string;
}) {
    return (
        <div className="h-10 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                >
                    <Line
                        type="monotone"
                        dataKey="y"
                        stroke={stroke}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * GitHub-contributions-style daily spending heatmap. Renders weeks as
 * columns (left → right oldest → newest) and days of the week as rows
 * (top = Sun). Cell intensity scales with each day's expense relative
 * to the period's max.
 *
 * Hover any cell to surface a floating card with the date, the day's
 * total, and a per-category breakdown.
 *
 * `days` is expected to be a contiguous date range, ordered oldest →
 * newest, with one entry per day (zero-spend days included).
 */
export function SpendingHeatmap({
    days,
    currency,
    tenantId,
}: {
    days: Array<{
        ymd: string;
        expense: number;
        byCategory?: Array<{ name: string; amount: number }>;
    }>;
    currency: string;
    /** When provided, the pinned-tooltip shows a "View in
     *  transactions" link scoped to this tenant + day. */
    tenantId?: string;
}) {
    return (
        <SpendingHeatmapImpl
            days={days}
            currency={currency}
            tenantId={tenantId}
        />
    );
}

interface HeatmapCell {
    ymd: string;
    expense: number;
    byCategory: Array<{ name: string; amount: number }>;
    col: number;
    row: number;
}

function SpendingHeatmapImpl({
    days,
    currency,
    tenantId,
}: {
    days: Array<{
        ymd: string;
        expense: number;
        byCategory?: Array<{ name: string; amount: number }>;
    }>;
    currency: string;
    tenantId?: string;
}) {
    // Hook order must be stable. Compute everything regardless of
    // whether `days` is empty; render the placeholder at the bottom.
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hover, setHover] = useState<{
        cell: HeatmapCell;
        x: number;
        y: number;
    } | null>(null);
    // Pinned selection (one ymd OR a range). Click = single-day pin;
    // mousedown + drag = range. Persists until cleared.
    const [pinned, setPinned] = useState<{
        startYmd: string;
        endYmd: string;
        // Anchor point for the floating tooltip when the selection is
        // pinned — based on the last cell entered during the drag.
        x: number;
        y: number;
    } | null>(null);
    const [dragging, setDragging] = useState(false);
    const dragAnchorRef = useRef<string | null>(null);

    // Release drag on global mouseup so dragging off the SVG still
    // commits the selection.
    useEffect(() => {
        if (!dragging) return;
        const onUp = () => setDragging(false);
        window.addEventListener('mouseup', onUp);
        return () => window.removeEventListener('mouseup', onUp);
    }, [dragging]);

    const max = Math.max(...days.map((d) => d.expense), 1);
    const first = days.length > 0 ? parseYmd(days[0]!.ymd) : new Date();
    const firstDow = first.getUTCDay();

    const cells: HeatmapCell[] = [];
    for (let i = 0; i < days.length; i++) {
        const idx = firstDow + i;
        cells.push({
            ymd: days[i]!.ymd,
            expense: days[i]!.expense,
            byCategory: days[i]!.byCategory ?? [],
            col: Math.floor(idx / 7),
            row: idx % 7,
        });
    }
    const cols =
        cells.length > 0 ? Math.max(...cells.map((c) => c.col)) + 1 : 0;

    // GitHub-style layout. Left gutter for weekday labels (Mon / Wed /
    // Fri), top gutter for month labels. Cells stay square inside the
    // viewBox; preserveAspectRatio="xMidYMid meet" + maxHeight clamps
    // visual size to a tight horizontal strip.
    const cellSize = 14;
    const gap = 3;
    const pitch = cellSize + gap;
    const leftGutter = 28; // weekday labels
    const topGutter = 16; // month labels
    const gridX = leftGutter;
    const gridY = topGutter;
    const width = gridX + cols * pitch;
    const height = gridY + 7 * pitch;

    // Month labels: scan cells for the first day of each month and
    // record (label, col). The label goes above the column that
    // CONTAINS the 1st — matches GitHub's convention.
    const monthLabels: Array<{ col: number; text: string }> = [];
    {
        const seen = new Set<string>();
        for (const c of cells) {
            const d = parseYmd(c.ymd);
            if (d.getUTCDate() !== 1) continue;
            const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            monthLabels.push({
                col: c.col,
                text: d.toLocaleString(undefined, {
                    month: 'short',
                    timeZone: 'UTC',
                }),
            });
        }
    }

    // Day-of-week labels: rows 1 (Mon), 3 (Wed), 5 (Fri).
    const weekdayLabels: Array<{ row: number; text: string }> = [
        { row: 1, text: 'Mon' },
        { row: 3, text: 'Wed' },
        { row: 5, text: 'Fri' },
    ];

    if (days.length === 0) {
        return (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No spending data yet.
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative flex flex-col gap-2">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Daily spending heatmap"
                className="block w-full"
                style={{
                    maxWidth: '100%',
                    maxHeight: '180px',
                    height: 'auto',
                }}
                onMouseLeave={() => setHover(null)}
            >
                {/* Month labels along the top */}
                {monthLabels.map((m, idx) => (
                    <text
                        key={`m-${idx}`}
                        x={gridX + m.col * pitch}
                        y={topGutter - 5}
                        className="fill-muted-foreground"
                        style={{ fontSize: 10, fontFamily: 'inherit' }}
                    >
                        {m.text}
                    </text>
                ))}
                {/* Weekday labels along the left */}
                {weekdayLabels.map((w) => (
                    <text
                        key={`w-${w.row}`}
                        x={leftGutter - 4}
                        y={gridY + w.row * pitch + cellSize - 3}
                        textAnchor="end"
                        className="fill-muted-foreground"
                        style={{ fontSize: 10, fontFamily: 'inherit' }}
                    >
                        {w.text}
                    </text>
                ))}
                {cells.map((c) => {
                    const ratio = c.expense / max;
                    // Highlight cells inside the pinned range so the
                    // user can see what got selected during/after a
                    // drag. The range is normalized by string compare
                    // on ymd (lexicographic == chronological for ISO).
                    const inPinned =
                        pinned !== null &&
                        c.ymd >= pinned.startYmd &&
                        c.ymd <= pinned.endYmd;
                    return (
                        <rect
                            key={c.ymd}
                            x={gridX + c.col * pitch}
                            y={gridY + c.row * pitch}
                            width={cellSize}
                            height={cellSize}
                            rx={2}
                            fill={heatmapColor(ratio)}
                            stroke={inPinned ? 'hsl(217 91% 60%)' : 'none'}
                            strokeWidth={inPinned ? 1.5 : 0}
                            style={{
                                cursor: 'pointer',
                                userSelect: 'none',
                            }}
                            onMouseEnter={(e) => {
                                const rect =
                                    containerRef.current?.getBoundingClientRect();
                                const x = rect ? e.clientX - rect.left : 0;
                                const y = rect ? e.clientY - rect.top : 0;
                                if (dragging && dragAnchorRef.current) {
                                    // Extend the drag range. Normalize
                                    // start/end so the anchor can be
                                    // either before or after the
                                    // current cell on the calendar.
                                    const a = dragAnchorRef.current;
                                    const b = c.ymd;
                                    setPinned({
                                        startYmd: a < b ? a : b,
                                        endYmd: a < b ? b : a,
                                        x,
                                        y,
                                    });
                                } else if (!pinned) {
                                    setHover({ cell: c, x, y });
                                }
                            }}
                            onMouseMove={(e) => {
                                if (pinned || dragging) return;
                                const rect =
                                    containerRef.current?.getBoundingClientRect();
                                if (!rect) return;
                                setHover({
                                    cell: c,
                                    x: e.clientX - rect.left,
                                    y: e.clientY - rect.top,
                                });
                            }}
                            onMouseDown={(e) => {
                                // Start a drag anchored here. Clears
                                // any previous pin so a fresh selection
                                // overrides it.
                                e.preventDefault();
                                const rect =
                                    containerRef.current?.getBoundingClientRect();
                                const x = rect ? e.clientX - rect.left : 0;
                                const y = rect ? e.clientY - rect.top : 0;
                                dragAnchorRef.current = c.ymd;
                                setDragging(true);
                                setHover(null);
                                setPinned({
                                    startYmd: c.ymd,
                                    endYmd: c.ymd,
                                    x,
                                    y,
                                });
                            }}
                        />
                    );
                })}
            </svg>
            {pinned
                ? (() => {
                      // Aggregate every day in [startYmd, endYmd]
                      // (inclusive). Single-day pin renders the same
                      // category breakdown the hover tooltip did;
                      // multi-day rolls up by category.
                      const inRange = cells.filter(
                          (c) =>
                              c.ymd >= pinned.startYmd &&
                              c.ymd <= pinned.endYmd,
                      );
                      const total = inRange.reduce(
                          (s, c) => s + c.expense,
                          0,
                      );
                      const catAgg = new Map<string, number>();
                      for (const c of inRange) {
                          for (const cat of c.byCategory) {
                              catAgg.set(
                                  cat.name,
                                  (catAgg.get(cat.name) ?? 0) + cat.amount,
                              );
                          }
                      }
                      const cats = Array.from(catAgg.entries())
                          .map(([name, amount]) => ({ name, amount }))
                          .sort((a, b) => b.amount - a.amount);
                      const isRange =
                          pinned.startYmd !== pinned.endYmd;
                      const container = containerRef.current;
                      const cw = container?.offsetWidth ?? 0;
                      const ch = container?.offsetHeight ?? 0;
                      const tipW = 240;
                      const tipH = 160;
                      const pad = 8;
                      const offset = 10;
                      let left = pinned.x + offset;
                      let top = pinned.y + offset;
                      left = Math.max(
                          pad,
                          Math.min(left, cw - tipW - pad),
                      );
                      top = Math.max(
                          pad,
                          Math.min(top, ch - tipH - pad),
                      );
                      const viewHref = tenantId
                          ? `/tenants/${tenantId}/transactions?from=${pinned.startYmd}&to=${pinned.endYmd}&transactionType=expense`
                          : null;
                      return (
                          <div
                              role="dialog"
                              className="absolute z-20 max-w-[260px] min-w-[200px] rounded-md border bg-popover p-2 text-xs shadow-md"
                              style={{ left, top }}
                          >
                              <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium">
                                      {isRange
                                          ? `${formatDateLabel(pinned.startYmd)} — ${formatDateLabel(pinned.endYmd)}`
                                          : formatDateLabel(
                                                pinned.startYmd,
                                            )}
                                  </p>
                                  <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground"
                                      aria-label="Clear selection"
                                      onClick={() => {
                                          setPinned(null);
                                          dragAnchorRef.current = null;
                                      }}
                                  >
                                      ✕
                                  </button>
                              </div>
                              <p className="text-muted-foreground">
                                  Total:{' '}
                                  <span className="font-mono tabular-nums">
                                      {formatMoney(total, currency)}
                                  </span>
                                  {isRange ? (
                                      <span className="ml-1">
                                          · {inRange.length} day
                                          {inRange.length === 1 ? '' : 's'}
                                      </span>
                                  ) : null}
                              </p>
                              {cats.length > 0 ? (
                                  <ul className="mt-1 flex flex-col gap-0.5 border-t pt-1">
                                      {cats.slice(0, 6).map((c) => (
                                          <li
                                              key={c.name}
                                              className="flex items-center justify-between gap-3"
                                          >
                                              <span>{c.name}</span>
                                              <span className="font-mono tabular-nums text-muted-foreground">
                                                  {formatMoney(
                                                      c.amount,
                                                      currency,
                                                  )}
                                              </span>
                                          </li>
                                      ))}
                                  </ul>
                              ) : total === 0 ? (
                                  <p className="mt-1 text-muted-foreground">
                                      No spending in this range.
                                  </p>
                              ) : null}
                              {viewHref ? (
                                  <a
                                      href={viewHref}
                                      className="mt-2 inline-block text-sky-600 hover:text-sky-700 hover:underline dark:text-sky-400"
                                  >
                                      View in transactions →
                                  </a>
                              ) : null}
                          </div>
                      );
                  })()
                : hover
                  ? (() => {
                        const container = containerRef.current;
                        const cw = container?.offsetWidth ?? 0;
                        const ch = container?.offsetHeight ?? 0;
                        const tipW = 220;
                        const tipH = 120;
                        const pad = 8;
                        const offset = 10;
                        let left = hover.x + offset;
                        let top = hover.y + offset;
                        left = Math.max(
                            pad,
                            Math.min(left, cw - tipW - pad),
                        );
                        top = Math.max(
                            pad,
                            Math.min(top, ch - tipH - pad),
                        );
                        return (
                            <div
                                role="tooltip"
                                className="pointer-events-none absolute z-10 max-w-[220px] min-w-[180px] rounded-md border bg-popover p-2 text-xs shadow-md"
                                style={{ left, top }}
                            >
                                <p className="font-medium">
                                    {formatDateLabel(hover.cell.ymd)}
                                </p>
                                <p className="text-muted-foreground">
                                    Total:{' '}
                                    <span className="font-mono tabular-nums">
                                        {formatMoney(
                                            hover.cell.expense,
                                            currency,
                                        )}
                                    </span>
                                </p>
                                {hover.cell.byCategory.length > 0 ? (
                                    <ul className="mt-1 flex flex-col gap-0.5 border-t pt-1">
                                        {hover.cell.byCategory.map((c) => (
                                            <li
                                                key={c.name}
                                                className="flex items-center justify-between gap-3"
                                            >
                                                <span>{c.name}</span>
                                                <span className="font-mono tabular-nums text-muted-foreground">
                                                    {formatMoney(
                                                        c.amount,
                                                        currency,
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : hover.cell.expense === 0 ? (
                                    <p className="mt-1 text-muted-foreground">
                                        No spending.
                                    </p>
                                ) : null}
                            </div>
                        );
                    })()
                  : null}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Less</span>
                {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                    <span
                        key={r}
                        className="inline-block size-3 rounded-sm"
                        style={{ background: heatmapColor(r) }}
                    />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}

function formatDateLabel(ymd: string): string {
    try {
        const d = parseYmd(ymd);
        return d.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
        });
    } catch {
        return ymd;
    }
}

function heatmapColor(ratio: number): string {
    // Empty cells: GitHub-light's near-white background. Hard-coded
    // rather than `hsl(var(--muted))` because that CSS-var path
    // resolves to black on this app's theme. The constant looks the
    // same on both light + dark themes here.
    if (ratio === 0) return '#ebedf0';
    const steps = [
        'hsl(142 30% 80%)',
        'hsl(142 45% 65%)',
        'hsl(142 55% 50%)',
        'hsl(142 65% 40%)',
        'hsl(142 75% 30%)',
    ];
    const idx = Math.min(
        steps.length - 1,
        Math.max(0, Math.floor(ratio * (steps.length - 1) + 0.5)),
    );
    return steps[idx]!;
}

function parseYmd(ymd: string): Date {
    return new Date(`${ymd}T00:00:00Z`);
}

/**
 * Forward-looking cash-flow projection. Given the starting balance and
 * a list of per-day deltas (positive income, negative expense) derived
 * from active recurring templates, draws the projected running balance
 * over the next N days. Same area-line style as NetWorthLine — visual
 * continuity between retrospective and prospective trends.
 */
export function CashflowForecastChart({
    data,
    currency,
}: {
    data: Array<{ label: string; balance: number }>;
    currency: string;
}) {
    const fmt = (v: number) => formatMoney(v, currency);
    if (data.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Add recurring templates to see a forecast.
            </div>
        );
    }
    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                    <defs>
                        <linearGradient
                            id="cashflowFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor="hsl(43 96% 56%)"
                                stopOpacity={0.4}
                            />
                            <stop
                                offset="100%"
                                stopColor="hsl(43 96% 56%)"
                                stopOpacity={0}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        className="stroke-muted"
                    />
                    <XAxis
                        dataKey="label"
                        className="text-xs"
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        className="text-xs"
                        tickFormatter={(v) =>
                            v >= 1_000_00
                                ? `${Math.round(v / 100_00)}k`
                                : v >= 100
                                  ? `${Math.round(v / 100)}`
                                  : `${v}`
                        }
                        tickLine={false}
                        axisLine={false}
                        width={48}
                    />
                    <Tooltip
                        formatter={(v) =>
                            fmt(typeof v === 'number' ? v : Number(v))
                        }
                        contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="hsl(43 96% 46%)"
                        strokeWidth={2}
                        fill="url(#cashflowFill)"
                        name="Projected balance"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
