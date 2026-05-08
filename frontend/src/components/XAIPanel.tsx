'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

// ─── SHAP Bar Chart (Global Feature Importance) ───────────────────────────────

interface ShapBarItem {
  feature: string
  importance: number
}

const ShapTooltip = ({
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
      <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 shadow-xl">
        <p className="text-slate-300 text-sm font-medium">{label}</p>
        <p className="text-emerald-400 text-sm">
          Importance: <span className="font-bold">{payload[0].value.toFixed(4)}</span>
        </p>
      </div>
    )
  }
  return null
}

export function ShapBarChart({ data }: { data: ShapBarItem[] }) {
  const sorted = [...data].sort((a, b) => b.importance - a.importance)

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-white font-semibold mb-1">Global Feature Importance (SHAP)</h3>
      <p className="text-slate-400 text-sm mb-4">
        Mean absolute SHAP values — higher means more influential
      </p>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(v) => v.toFixed(3)}
          />
          <YAxis
            dataKey="feature"
            type="category"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            width={115}
          />
          <Tooltip content={<ShapTooltip />} />
          <Bar dataKey="importance" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {sorted.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index === 0 ? '#10b981' : index === 1 ? '#34d399' : '#6ee7b7'}
                fillOpacity={1 - index * 0.06}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── SHAP Waterfall Chart (Local Explanation) ─────────────────────────────────

interface ShapWaterfallItem {
  feature: string
  shap_value: number
  direction: string
}

const WaterfallTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    const val = payload[0].value
    return (
      <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 shadow-xl">
        <p className="text-slate-300 text-sm font-medium">{label}</p>
        <p className={`text-sm font-bold ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          SHAP: {val >= 0 ? '+' : ''}
          {val.toFixed(4)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {val >= 0 ? 'Increases' : 'Decreases'} prediction
        </p>
      </div>
    )
  }
  return null
}

export function ShapWaterfallChart({ data }: { data: ShapWaterfallItem[] }) {
  const sorted = [...data].sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-white font-semibold mb-1">Local SHAP Explanation</h3>
      <p className="text-slate-400 text-sm mb-4">
        SHAP values for this prediction instance — green pushes higher, red pushes lower
      </p>
      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
          Positive impact
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded bg-red-500 inline-block" />
          Negative impact
        </span>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 5, right: 40, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(v) => (v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3))}
          />
          <YAxis
            dataKey="feature"
            type="category"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            width={115}
          />
          <Tooltip content={<WaterfallTooltip />} />
          <ReferenceLine x={0} stroke="#475569" strokeWidth={1.5} />
          <Bar dataKey="shap_value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {sorted.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.shap_value >= 0 ? '#10b981' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── LIME Chart ───────────────────────────────────────────────────────────────

interface LimeItem {
  feature: string
  weight: number
}

const LimeTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    const val = payload[0].value
    return (
      <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 shadow-xl">
        <p className="text-slate-300 text-sm font-medium">{label}</p>
        <p className={`text-sm font-bold ${val >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
          Weight: {val >= 0 ? '+' : ''}
          {val.toFixed(4)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {val >= 0 ? 'Positive' : 'Negative'} local influence
        </p>
      </div>
    )
  }
  return null
}

export function LimeChart({ data }: { data: LimeItem[] }) {
  const sorted = [...data].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-white font-semibold mb-1">LIME Local Explanation</h3>
      <p className="text-slate-400 text-sm mb-4">
        LIME feature weights — local linear approximation around the prediction
      </p>
      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
          Positive weight
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded bg-orange-500 inline-block" />
          Negative weight
        </span>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 5, right: 40, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(v) => (v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3))}
          />
          <YAxis
            dataKey="feature"
            type="category"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            width={115}
          />
          <Tooltip content={<LimeTooltip />} />
          <ReferenceLine x={0} stroke="#475569" strokeWidth={1.5} />
          <Bar dataKey="weight" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {sorted.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.weight >= 0 ? '#3b82f6' : '#f97316'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
