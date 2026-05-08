'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  History,
  RefreshCw,
  Trash2,
  TrendingUp,
  BarChart2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { getForecastHistory, clearForecastHistory } from '@/src/lib/api'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface HistoryEntry {
  id: string
  city: string
  model: string
  predicted_kwh: number
  r2: number
  timestamp: string
}

const MODEL_COLORS: Record<string, string> = {
  Ensemble: '#10b981',
  CNN: '#3b82f6',
  LSTM: '#a855f7',
  GRU: '#f97316',
}

function r2ColorClass(r2: number) {
  if (r2 >= 0.93) return 'text-emerald-400'
  if (r2 >= 0.90) return 'text-yellow-400'
  return 'text-red-400'
}

function r2BadgeClass(r2: number) {
  if (r2 >= 0.93) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (r2 >= 0.90) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  return 'bg-red-500/10 text-red-400 border-red-500/20'
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-700/50 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-700 rounded w-3/4" />
        </td>
      ))}
    </tr>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-slate-400 text-xs font-medium">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

const MOCK_HISTORY: HistoryEntry[] = [
  { id: '1', city: 'Lahore', model: 'Ensemble', predicted_kwh: 201.4, r2: 0.947, timestamp: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: '2', city: 'Karachi', model: 'CNN', predicted_kwh: 218.7, r2: 0.921, timestamp: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: '3', city: 'Islamabad', model: 'LSTM', predicted_kwh: 172.8, r2: 0.934, timestamp: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: '4', city: 'Multan', model: 'GRU', predicted_kwh: 247.2, r2: 0.918, timestamp: new Date(Date.now() - 90 * 60000).toISOString() },
  { id: '5', city: 'Peshawar', model: 'Ensemble', predicted_kwh: 163.5, r2: 0.952, timestamp: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: '6', city: 'Skardu', model: 'CNN', predicted_kwh: 122.4, r2: 0.889, timestamp: new Date(Date.now() - 6 * 3600000).toISOString() },
]

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getForecastHistory()
      const data = res.data
      const entries: HistoryEntry[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.history)
        ? data.history
        : []
      setHistory(entries)
    } catch {
      setError('Backend unreachable. Showing mock history data.')
      setHistory(MOCK_HISTORY)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleClear = async () => {
    if (!window.confirm('Clear all forecast history? This cannot be undone.')) return
    try {
      await clearForecastHistory()
      setHistory([])
    } catch {
      setHistory([])
    }
  }

  // Stats
  const totalRuns = history.length
  const avgKwh = totalRuns > 0 ? history.reduce((s, e) => s + e.predicted_kwh, 0) / totalRuns : 0
  const modelCounts = history.reduce<Record<string, number>>((acc, e) => {
    acc[e.model] = (acc[e.model] ?? 0) + 1
    return acc
  }, {})
  const mostUsedModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  const cityCounts = history.reduce<Record<string, number>>((acc, e) => {
    acc[e.city] = (acc[e.city] ?? 0) + 1
    return acc
  }, {})
  const mostForecastedCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // Chart data — last 30 entries, sorted by time
  const chartData = [...history]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-30)
    .map((e, i) => ({
      idx: i + 1,
      kwh: parseFloat(e.predicted_kwh.toFixed(2)),
      model: e.model,
      city: e.city,
      time: relativeTime(e.timestamp),
    }))

  // Paginated rows
  const pagedHistory = history.slice(0, page * PAGE_SIZE)

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" />
            Forecast History
          </h1>
          <p className="text-slate-400 mt-1 text-sm">All previous forecast runs with metrics</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchHistory}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {history.length > 0 && (
            <button
              onClick={handleClear}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="text-yellow-400 text-sm">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && history.length === 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-16 flex flex-col items-center text-center">
          <History className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-300 font-semibold mb-2">No forecasts yet</p>
          <p className="text-slate-500 text-sm">
            Run your first forecast on the{' '}
            <a href="/forecast" className="text-emerald-400 hover:underline">
              Forecast page
            </a>
          </p>
        </div>
      )}

      {/* Stats row */}
      {(loading || history.length > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BarChart2} label="Total Runs" value={loading ? '—' : String(totalRuns)} color="text-emerald-400" />
          <StatCard icon={TrendingUp} label="Avg kWh" value={loading ? '—' : `${avgKwh.toFixed(1)} kWh`} color="text-blue-400" />
          <StatCard icon={RefreshCw} label="Most Used Model" value={loading ? '—' : mostUsedModel} color="text-purple-400" />
          <StatCard icon={Clock} label="Most Forecasted City" value={loading ? '—' : mostForecastedCity} color="text-orange-400" />
        </div>
      )}

      {/* Area chart */}
      {!loading && chartData.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            kWh Over Time
          </h2>
          <p className="text-slate-400 text-xs mb-5">Last {chartData.length} forecast runs</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="kwhGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="idx" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#475569" label={{ value: 'Run #', fill: '#64748b', fontSize: 11, position: 'insideBottomRight', offset: -5 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#475569" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                itemStyle={{ color: '#10b981' }}
                formatter={(value: number) => [`${value} kWh`, 'Predicted']}
                labelFormatter={(label) => `Run #${label}`}
              />
              <Area
                type="monotone"
                dataKey="kwh"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#kwhGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {(loading || history.length > 0) && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-700">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Forecast Runs
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Showing last {Math.min(pagedHistory.length, totalRuns)} of {totalRuns} runs
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  {['City', 'Model', 'Predicted kWh', 'R²', 'Time'].map((col) => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                  : pagedHistory.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-slate-200 font-medium">
                          <span className="flex items-center gap-1.5">🇵🇰 {entry.city}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                            style={{
                              color: MODEL_COLORS[entry.model] ?? '#94a3b8',
                              backgroundColor: `${MODEL_COLORS[entry.model] ?? '#94a3b8'}15`,
                              borderColor: `${MODEL_COLORS[entry.model] ?? '#94a3b8'}30`,
                            }}
                          >
                            {entry.model}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-emerald-400 font-semibold">
                          {entry.predicted_kwh.toFixed(2)} kWh
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${r2BadgeClass(entry.r2)}`}>
                            {entry.r2.toFixed(3)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {relativeTime(entry.timestamp)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {!loading && pagedHistory.length < totalRuns && (
            <div className="p-4 border-t border-slate-700 text-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                Show more ({totalRuns - pagedHistory.length} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
