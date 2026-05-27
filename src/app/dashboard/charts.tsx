'use client';

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
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
