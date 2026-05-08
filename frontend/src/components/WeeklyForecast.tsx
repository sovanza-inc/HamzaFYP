'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getWeeklyForecast } from '@/src/lib/api'
import { ChartSkeleton } from './Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayForecast {
  day: string        // Mon, Tue …
  date: string       // e.g. 2025-01-13
  predicted_kwh: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function barColor(kwh: number): string {
  if (kwh < 25) return '#10b981'   // emerald — low
  if (kwh < 35) return '#eab308'   // yellow — medium
  return '#ef4444'                  // red — high
}

function demandLabel(kwh: number): string {
  if (kwh < 25) return 'Low'
  if (kwh < 35) return 'Medium'
  return 'High'
}

function demandLabelColor(kwh: number): string {
  if (kwh < 25) return 'text-emerald-400'
  if (kwh < 35) return 'text-yellow-400'
  return 'text-red-400'
}

/** Generate 7-day mock data starting from today */
function mockWeeklyData(): DayForecast[] {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return {
      day: DAY_NAMES[d.getDay()],
      date: d.toISOString().slice(0, 10),
      predicted_kwh: parseFloat((20 + Math.sin((i * Math.PI) / 3) * 10 + Math.random() * 5).toFixed(2)),
    }
  })
}

/** Normalise whatever shape the API returns */
function parseWeeklyData(raw: unknown): DayForecast[] {
  const today = new Date()

  if (Array.isArray(raw)) {
    return raw.slice(0, 7).map((item: Record<string, unknown>, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      return {
        day:           item.day as string  ?? DAY_NAMES[d.getDay()],
        date:          item.date as string ?? d.toISOString().slice(0, 10),
        predicted_kwh: parseFloat(
          String(item.predicted_kwh ?? item.kwh ?? item.energy ?? 28)
        ),
      }
    })
  }
  return mockWeeklyData()
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const WeeklyTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    const kwh = payload[0].value
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-white font-medium">{label}</p>
        <p style={{ color: barColor(kwh) }}>
          {kwh.toFixed(2)} kWh — {demandLabel(kwh)}
        </p>
      </div>
    )
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyForecast({ city }: { city: string }) {
  const [days, setDays] = useState<DayForecast[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWeekly = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getWeeklyForecast(city)
      const parsed = parseWeeklyData(res.data?.forecast ?? res.data)
      setDays(parsed)
    } catch {
      setDays(mockWeeklyData())
    } finally {
      setLoading(false)
    }
  }, [city])

  useEffect(() => {
    fetchWeekly()
  }, [fetchWeekly])

  if (loading) return <ChartSkeleton />

  const totalKwh = days.reduce((s, d) => s + d.predicted_kwh, 0)
  const maxKwh   = Math.max(...days.map((d) => d.predicted_kwh))

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-white font-semibold">7-Day Energy Forecast</h3>
        <p className="text-slate-400 text-sm mt-0.5">{city} — daily predicted demand</p>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={days} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            width={45}
            label={{
              value: 'kWh',
              angle: -90,
              position: 'insideLeft',
              offset: 15,
              fill: '#64748b',
              fontSize: 12,
            }}
          />
          <Tooltip content={<WeeklyTooltip />} />
          <Bar dataKey="predicted_kwh" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {days.map((d) => (
              <Cell key={d.date} fill={barColor(d.predicted_kwh)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Day cards row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {days.map((d) => {
          const pct = maxKwh > 0 ? (d.predicted_kwh / maxKwh) * 100 : 50
          const dateShort = new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short',
          })
          return (
            <div
              key={d.date}
              className="flex flex-col items-center bg-slate-700/50 rounded-xl p-3 min-w-[74px] border border-slate-600/50 shrink-0"
            >
              <span className="text-white text-sm font-semibold">{d.day}</span>
              <span className="text-slate-500 text-xs mb-2">{dateShort}</span>
              {/* Mini bar */}
              <div className="w-full bg-slate-600/50 rounded-full h-16 flex flex-col justify-end mb-2">
                <div
                  className="w-full rounded-full transition-all duration-500"
                  style={{ height: `${pct}%`, background: barColor(d.predicted_kwh) }}
                />
              </div>
              <span className={`text-xs font-bold ${demandLabelColor(d.predicted_kwh)}`}>
                {d.predicted_kwh.toFixed(1)}
              </span>
              <span className="text-slate-500 text-xs">kWh</span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-700 pt-3">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Low &lt;25 kWh
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Medium 25–35 kWh
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> High &gt;35 kWh
          </span>
        </div>
        <p className="text-slate-300 text-sm font-semibold">
          Total: <span className="text-emerald-400">{totalKwh.toFixed(1)} kWh</span>
        </p>
      </div>
    </div>
  )
}
