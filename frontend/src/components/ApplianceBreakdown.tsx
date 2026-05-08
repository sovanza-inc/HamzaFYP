'use client'

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplianceBreakdownProps {
  city: string
  predictions: number[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const APPLIANCE_SPLITS = [
  { name: 'AC',           share: 0.45, color: '#3b82f6' },  // blue
  { name: 'Lighting',     share: 0.18, color: '#eab308' },  // yellow
  { name: 'Kitchen',      share: 0.15, color: '#10b981' },  // emerald
  { name: 'Water Heater', share: 0.12, color: '#f97316' },  // orange
  { name: 'Other',        share: 0.10, color: '#64748b' },  // slate
]

// ─── Custom Tooltip (Pie) ─────────────────────────────────────────────────────

const PieTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { share: number } }>
}) => {
  if (active && payload && payload.length) {
    const item = payload[0]
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-white font-medium">{item.name}</p>
        <p className="text-slate-300">{item.value.toFixed(3)} kWh</p>
        <p className="text-slate-400">{(item.payload.share * 100).toFixed(0)}% of total</p>
      </div>
    )
  }
  return null
}

// ─── Custom Tooltip (Bar) ─────────────────────────────────────────────────────

const BarTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-slate-300 mb-1">Hour {label}</p>
        <p className="text-blue-400 font-semibold">AC load: {payload[0].value.toFixed(3)} kWh</p>
      </div>
    )
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApplianceBreakdown({ city, predictions }: ApplianceBreakdownProps) {
  const totalKwh = predictions.reduce((s, v) => s + v, 0)

  // Pie data — scale each appliance share by total kWh
  const pieData = APPLIANCE_SPLITS.map((a) => ({
    name:  a.name,
    value: parseFloat((a.share * totalKwh).toFixed(3)),
    share: a.share,
    color: a.color,
  }))

  // Hourly AC bar — 70% of each hour's prediction during daytime (hours 6–20), else 0
  const barData = predictions.map((kwh, i) => ({
    hour: String(i + 1),
    acLoad: i >= 5 && i <= 19
      ? parseFloat((kwh * 0.7).toFixed(4))
      : parseFloat((kwh * 0.05).toFixed(4)),
  }))

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-6">
      {/* Section header */}
      <div>
        <h3 className="text-white font-semibold">Appliance Breakdown</h3>
        <p className="text-slate-400 text-sm mt-0.5">
          {city} — estimated load distribution for {totalKwh.toFixed(2)} kWh daily forecast
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Pie Chart ── */}
        <div>
          <h4 className="text-slate-300 text-sm font-medium mb-3">Daily Demand Share</h4>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-slate-300 text-xs">{value}</span>
                )}
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend table */}
          <div className="space-y-1.5 mt-2">
            {pieData.map((a) => (
              <div key={a.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: a.color }}
                  />
                  <span className="text-slate-300">{a.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{a.value.toFixed(2)} kWh</span>
                  <span className="text-slate-500 w-8 text-right">
                    {(a.share * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bar Chart ── */}
        <div>
          <h4 className="text-slate-300 text-sm font-medium mb-3">Hourly AC Load Estimate</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                interval={2}
                label={{
                  value: 'Hour',
                  position: 'insideBottom',
                  offset: -2,
                  fill: '#64748b',
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                width={45}
                tickFormatter={(v) => `${v}`}
                label={{
                  value: 'kWh',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 15,
                  fill: '#64748b',
                  fontSize: 11,
                }}
              />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="acLoad" fill="#3b82f6" name="AC Load" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-slate-500 text-xs mt-2">
            Daytime AC load estimated at 70% of hourly forecast (06:00–20:00)
          </p>
        </div>
      </div>
    </div>
  )
}
