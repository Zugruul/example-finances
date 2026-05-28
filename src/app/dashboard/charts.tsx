'use client';

import { useRef, useState } from 'react';
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
}: {
    days: Array<{
        ymd: string;
        expense: number;
        byCategory?: Array<{ name: string; amount: number }>;
    }>;
    currency: string;
}) {
    return (
        <SpendingHeatmapImpl days={days} currency={currency} />
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
}: {
    days: Array<{
        ymd: string;
        expense: number;
        byCategory?: Array<{ name: string; amount: number }>;
    }>;
    currency: string;
}) {
    // Hook order must be stable. Compute everything regardless of
    // whether `days` is empty; render the placeholder at the bottom.
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hover, setHover] = useState<{
        cell: HeatmapCell;
        x: number;
        y: number;
    } | null>(null);

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
    // GitHub-style square cells; SVG scales to fit width while
    // preserving the viewBox aspect (12 cols × 7 rows ≈ 1.7:1). Cap
    // the rendered width so on very wide cards the cells don't grow
    // into mosaic tiles — the chart is more readable as a tight grid.
    const cellSize = 14;
    const gap = 2;
    const width = cols * (cellSize + gap);
    const height = 7 * (cellSize + gap);

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
                // Scale up nicely on wider cards (~3x natural size at
                // 600px container width) but never grow taller than the
                // GitHub-style proportions allow. Width hits 100% only
                // when the container is narrower than the natural
                // viewBox; otherwise we let the height-cap drive the
                // visible size.
                className="block w-full"
                style={{
                    maxWidth: '100%',
                    maxHeight: '160px',
                    height: 'auto',
                }}
                onMouseLeave={() => setHover(null)}
            >
                {cells.map((c) => {
                    const ratio = c.expense / max;
                    return (
                        <rect
                            key={c.ymd}
                            x={c.col * (cellSize + gap)}
                            y={c.row * (cellSize + gap)}
                            width={cellSize}
                            height={cellSize}
                            rx={2}
                            fill={heatmapColor(ratio)}
                            onMouseEnter={(e) => {
                                const rect =
                                    containerRef.current?.getBoundingClientRect();
                                if (!rect) {
                                    setHover({ cell: c, x: 0, y: 0 });
                                    return;
                                }
                                setHover({
                                    cell: c,
                                    x: e.clientX - rect.left,
                                    y: e.clientY - rect.top,
                                });
                            }}
                            onMouseMove={(e) => {
                                const rect =
                                    containerRef.current?.getBoundingClientRect();
                                if (!rect) return;
                                setHover({
                                    cell: c,
                                    x: e.clientX - rect.left,
                                    y: e.clientY - rect.top,
                                });
                            }}
                        />
                    );
                })}
            </svg>
            {hover ? (
                <div
                    role="tooltip"
                    className="pointer-events-none absolute z-10 min-w-[180px] rounded-md border bg-popover p-2 text-xs shadow-md"
                    style={{
                        left: Math.min(
                            hover.x + 12,
                            (containerRef.current?.offsetWidth ?? 0) - 200,
                        ),
                        top: hover.y + 12,
                    }}
                >
                    <p className="font-medium">
                        {formatDateLabel(hover.cell.ymd)}
                    </p>
                    <p className="text-muted-foreground">
                        Total:{' '}
                        <span className="font-mono tabular-nums">
                            {formatMoney(hover.cell.expense, currency)}
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
                                        {formatMoney(c.amount, currency)}
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
            ) : null}
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
    if (ratio === 0) return 'hsl(var(--muted))';
    // Five steps from muted to a saturated emerald.
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
