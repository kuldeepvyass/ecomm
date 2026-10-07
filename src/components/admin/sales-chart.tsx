"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/money";

type Point = { date: string; revenue: number; orders: number };

const short = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${Math.round(n / 1e3)}k` : `₹${n}`);
const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Single series (daily revenue): one validated hue, no legend — the title names it. Crosshair tooltip + table view. */
export function SalesChart({ data }: { data: Point[] }) {
  const [table, setTable] = useState(false);
  return (
    <section className="border border-border bg-surface p-4 md:p-6" aria-labelledby="sales-h">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="sales-h" className="text-xl">Revenue — last 30 days</h2>
        <button type="button" onClick={() => setTable((t) => !t)} className="min-h-10 text-xs uppercase tracking-[0.12em] text-fg-muted hover:text-gold">{table ? "Show chart" : "View as table"}</button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.12em] text-fg-muted"><tr><th className="py-2">Date</th><th className="py-2 text-right">Orders</th><th className="py-2 text-right">Revenue</th></tr></thead>
            <tbody className="divide-y divide-border">{data.map((d) => <tr key={d.date}><td className="py-1.5">{day(d.date)}</td><td className="py-1.5 text-right tabular-nums">{d.orders}</td><td className="py-1.5 text-right tabular-nums">{formatINR(d.revenue)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="h-64" role="img" aria-label={`Daily revenue for the last 30 days, total ${formatINR(data.reduce((s, d) => s + d.revenue, 0))}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="date" tickFormatter={day} tick={{ fill: "var(--fg-muted)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tickFormatter={short} tick={{ fill: "var(--fg-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Point;
                  return (
                    <div className="border border-border bg-surface-2 px-3 py-2 text-xs shadow-luxe">
                      <p className="text-fg-muted">{day(p.date)}</p>
                      <p className="mt-1 text-sm text-fg">{formatINR(p.revenue)}</p>
                      <p className="text-fg-muted">{p.orders} {p.orders === 1 ? "order" : "orders"}</p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#rev)" activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--chart-1)" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
