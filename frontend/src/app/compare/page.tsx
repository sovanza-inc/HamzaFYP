'use client'

import { useState } from 'react'
import {
  BarChart2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  AlertCircle,
} from 'lucide-react'
import { compareModels } from '@/src/lib/api'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  ResponsiveContainer,
} from 'recharts'

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Multan', 'Peshawar', 'Skardu']
const MODELS = ['Ensemble', 'CNN', 'LSTM', 'GRU']

const CITY_COLORS: Record<string, string> = {
  Lahore: '#10b981',
  Karachi: '#3b82f6',
  Islamabad: '#a855f7',
  Multan: '#f97316',
  Peshawar: '#ec4899',
  Skardu: '#eab308',
}

interface CityResult {
  city: string
  predicted_kwh: number
  best_model: string
  r2: number
  hourly_predictions: number[]
}

function r2Color(r2: number) {
  if (r2 >= 0.93) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (r2 >= 0.90) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
  return 'text-red-400 bg-red-500/10 border-red-500/20'
}

function generateMockResult(city: string, model: string): CityResult {
  const base = { Lahore: 8.4, Karachi: 9.1, Islamabad: 7.2, Multan: 10.3, Peshawar: 6.8, Skardu: 5.1 }[city] ?? 7.5
  const hourly = Array.from({ length: 24 }, (_, i) =>
    parseFloat((base * (0.5 + 0.5 * Math.sin((i - 6) * Math.PI / 12) + Math.random() * 0.05)).toFixed(3))
  )
  const r2Values: Record<string, number> = { Ensemble: 0.947, CNN: 0.921, LSTM: 0.934, GRU: 0.918 }
  return {
    city,
    predicted_kwh: parseFloat(hourly.reduce((a, b) => a + b, 0).toFixed(2)),
    best_model: model,
    r2: r2Values[model] ?? 0.93,
    hourly_predictions: hourly,
  }
}

function SkeletonCard() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-28 bg-slate-700 rounded" />
        <div className="h-5 w-16 bg-slate-700 rounded-full" />
      </div>
      <div className="h-10 w-24 bg-slate-700 rounded mb-2" />
      <div className="h-4 w-20 bg-slate-700 rounded mb-4" />
      <div className="h-12 bg-slate-700 rounded" />
    </div>
  )
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ h: i + 1, v }))
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function ComparePage() {
  const [selectedModel, setSelectedModel] = useState('Ensemble')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CityResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCompare = async () => {
    setLoading(true)
    setError(null)
    try {
      const responses = await Promise.all(CITIES.map((city) => compareModels(city)))
      const parsed: CityResult[] = responses.map((res, i) => {
        const d = res.data
        return {
          city: CITIES[i],
          predicted_kwh: d?.predicted_kwh ?? d?.predicted_daily_kwh ?? d?.total_kwh ?? 0,
          best_model: d?.best_model ?? selectedModel,
          r2: d?.r2 ?? d?.r2_score ?? 0,
          hourly_predictions: d?.hourly_predictions ?? d?.predictions ?? [],
        }
      })
      setResults(parsed)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Backend unreachable (${msg}). Showing mock comparison data.`)
      setResults(CITIES.map((city) => generateMockResult(city, selectedModel)))
    } finally {
      setLoading(false)
    }
  }

  const handleModelChange = async (model: string) => {
    setSelectedModel(model)
    if (results) {
      setLoading(true)
      setError(null)
      try {
        const responses = await Promise.all(CITIES.map((city) => compareModels(city)))
        const parsed: CityResult[] = responses.map((res, i) => {
          const d = res.data
          return {
            city: CITIES[i],
            predicted_kwh: d?.predicted_kwh ?? d?.predicted_daily_kwh ?? d?.total_kwh ?? 0,
            best_model: d?.best_model ?? model,
            r2: d?.r2 ?? d?.r2_score ?? 0,
            hourly_predictions: d?.hourly_predictions ?? d?.predictions ?? [],
          }
        })
        setResults(parsed)
      } catch {
        setResults(CITIES.map((city) => generateMockResult(city, model)))
        setError('Backend unreachable. Showing mock comparison data.')
      } finally {
        setLoading(false)
      }
    }
  }

  const highestCity = results?.reduce((a, b) => (a.predicted_kwh > b.predicted_kwh ? a : b))
  const lowestCity = results?.reduce((a, b) => (a.predicted_kwh < b.predicted_kwh ? a : b))

  // Build combined chart data (24 hours)
  const combinedChartData = Array.from({ length: 24 }, (_, i) => {
    const point: Record<string, number | string> = { hour: `H${i + 1}` }
    results?.forEach((r) => {
      point[r.city] = r.hourly_predictions[i] ?? 0
    })
    return point
  })

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-emerald-400" />
            City Comparison
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Side-by-side energy demand forecast across all 6 Pakistani cities
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Model selector */}
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 pr-8"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={handleCompare}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-5 py-2.5 text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Comparing…
              </>
            ) : (
              <>
                <BarChart2 className="w-4 h-4" />
                Compare All Cities
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="text-yellow-400 text-sm">{error}</p>
        </div>
      )}

      {/* Demand badges */}
      {results && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-300">Highest demand:</span>
            <span className="text-sm font-bold text-emerald-400">{highestCity?.city} 🇵🇰</span>
            <span className="text-xs text-slate-400">({highestCity?.predicted_kwh.toFixed(2)} kWh)</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5">
            <TrendingDown className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-300">Lowest demand:</span>
            <span className="text-sm font-bold text-blue-400">{lowestCity?.city} 🇵🇰</span>
            <span className="text-xs text-slate-400">({lowestCity?.predicted_kwh.toFixed(2)} kWh)</span>
          </div>
        </div>
      )}

      {/* City cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : results?.map((r) => (
              <div
                key={r.city}
                className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
              >
                {/* City name */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
                    <span>🇵🇰</span>
                    {r.city}
                  </h3>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full border border-slate-600">
                    {r.best_model}
                  </span>
                </div>

                {/* kWh */}
                <p className="text-3xl font-bold text-emerald-400 leading-none mb-0.5">
                  {r.predicted_kwh.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mb-3">kWh (24h total)</p>

                {/* R2 badge */}
                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border mb-3 ${r2Color(r.r2)}`}>
                  R² {r.r2.toFixed(3)}
                </span>

                {/* Sparkline */}
                {r.hourly_predictions.length > 0 && (
                  <MiniSparkline data={r.hourly_predictions} color={CITY_COLORS[r.city] ?? '#10b981'} />
                )}
              </div>
            ))}
      </div>

      {/* Combined multi-city chart */}
      {results && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            Hourly Demand — All Cities
          </h2>
          <p className="text-slate-400 text-xs mb-5">24-hour forecast per city (kWh)</p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={combinedChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#475569" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#475569" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                itemStyle={{ color: '#cbd5e1' }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              {CITIES.map((city) => (
                <Line
                  key={city}
                  type="monotone"
                  dataKey={city}
                  stroke={CITY_COLORS[city]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state */}
      {!loading && !results && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-16 flex flex-col items-center text-center">
          <BarChart2 className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-300 font-semibold mb-2">No comparison data yet</p>
          <p className="text-slate-500 text-sm">
            Click <strong className="text-slate-400">Compare All Cities</strong> to run forecasts for all 6 Pakistani cities simultaneously.
          </p>
        </div>
      )}
    </div>
  )
}
