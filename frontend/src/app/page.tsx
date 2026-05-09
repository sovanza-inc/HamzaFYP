'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  Cpu,
  MapPin,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  TrendingUp,
  Zap,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Award,
} from 'lucide-react'
import { getHealth, getRangeForecast } from '@/src/lib/api'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Multan', 'Peshawar', 'Skardu']

interface DayForecast {
  date: string
  day_label: string
  predicted_kwh: number
  lower_ci: number
  upper_ci: number
  peak_hour: number
  hourly_predictions: number[]
}

interface RangeResponse {
  city: string
  model: string
  start_date: string
  end_date: string
  days: DayForecast[]
  total_kwh: number
  avg_daily_kwh: number
  peak_day: { date: string; kwh: number }
  lowest_day: { date: string; kwh: number }
  ensemble_r2: number
  models_used: string[]
}

const STAT_CARDS = [
  {
    label: 'Ensemble R²',
    value: '0.9900',
    sub: 'CNN + LSTM + GRU',
    icon: Target,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    trend: '+5.2%',
  },
  {
    label: 'Best RMSE',
    value: '0.0180',
    sub: 'kWh per hour',
    icon: Activity,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    trend: '-12.3%',
  },
  {
    label: 'Cities Supported',
    value: '6',
    sub: 'Pakistani cities',
    icon: MapPin,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    label: 'Models Integrated',
    value: '3',
    sub: 'Unified ensemble output',
    icon: Cpu,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
]

const ISO_TODAY = new Date().toISOString().slice(0, 10)
const ISO_PLUS_DAYS = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [city, setCity] = useState('Lahore')
  const [startDate, setStartDate] = useState(ISO_TODAY)
  const [endDate, setEndDate] = useState(ISO_PLUS_DAYS(6))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RangeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHealth()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'))
  }, [])

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await getRangeForecast(city, startDate, endDate)
      setResult(res.data as RangeResponse)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Forecast failed: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const chartData = result?.days.map((d) => ({
    date: d.day_label,
    kwh: d.predicted_kwh,
    lower: d.lower_ci,
    upper: d.upper_ci,
  }))

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Integrated ensemble forecasting · CNN + LSTM + GRU unified output
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
            backendStatus === 'online'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : backendStatus === 'offline'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          {backendStatus === 'online' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-green inline-block" />
              <CheckCircle className="w-4 h-4" />
              Backend Online
            </>
          ) : backendStatus === 'offline' ? (
            <>
              <AlertCircle className="w-4 h-4" />
              Backend Offline
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Checking...
            </>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                {card.trend && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                    {card.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-slate-300 font-medium text-sm mt-1">{card.label}</p>
              <p className="text-slate-500 text-xs mt-0.5">{card.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Forecast Engine */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Forecast Engine</h2>
            <p className="text-slate-500 text-xs">
              Pick a city and date range → integrated ensemble runs CNN, LSTM, GRU and produces a unified result
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* City */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> City
            </label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>

          {/* End date */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>

          {/* Run button */}
          <div className="flex items-end">
            <button
              onClick={handleRun}
              disabled={loading || backendStatus !== 'online'}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Forecast
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-slate-500 self-center">Quick range:</span>
          {[
            { label: 'Next 7 days', s: ISO_TODAY, e: ISO_PLUS_DAYS(6) },
            { label: 'Next 14 days', s: ISO_TODAY, e: ISO_PLUS_DAYS(13) },
            { label: 'Next 30 days', s: ISO_TODAY, e: ISO_PLUS_DAYS(29) },
          ].map((p) => (
            <button
              key={p.label}
              onClick={() => { setStartDate(p.s); setEndDate(p.e) }}
              className="px-3 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Result panel */}
      {result && (
        <div className="space-y-6 fade-in">
          {/* Insights */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total kWh</p>
              <p className="text-2xl font-bold text-white">{result.total_kwh.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{result.days.length} days</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Daily</p>
              <p className="text-2xl font-bold text-white">{result.avg_daily_kwh.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">kWh/day</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-red-400" /> Peak Day
              </p>
              <p className="text-2xl font-bold text-white">{result.peak_day.kwh.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{result.peak_day.date}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-emerald-400" /> Lowest Day
              </p>
              <p className="text-2xl font-bold text-white">{result.lowest_day.kwh.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{result.lowest_day.date}</p>
            </div>
          </div>

          {/* Forecast chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  {result.city} — Daily Energy Forecast
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {result.start_date} → {result.end_date} · Ensemble model · 88% confidence band
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {result.models_used.join(' + ')}
              </span>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="kwhArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ciArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" kWh" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="url(#ciArea)"
                  fillOpacity={1}
                  name="Upper CI"
                />
                <Area
                  type="monotone"
                  dataKey="kwh"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#kwhArea)"
                  fillOpacity={1}
                  name="Predicted kWh"
                  dot={{ fill: '#10b981', r: 3 }}
                  activeDot={{ r: 5, stroke: '#10b981', fill: '#fff' }}
                />
                <ReferenceLine
                  y={result.avg_daily_kwh}
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  label={{
                    value: `Avg ${result.avg_daily_kwh.toFixed(1)}`,
                    position: 'right',
                    fill: '#94a3b8',
                    fontSize: 10,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Model performance metrics */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-white font-semibold">Model Performance</h3>
              <span className="ml-auto text-xs text-slate-500">Test set · 12,162 hourly samples</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: 'CNN', r2: 0.9912, rmse: 0.0182, color: 'blue', weight: 0.3 },
                { name: 'LSTM', r2: 0.9833, rmse: 0.0251, color: 'purple', weight: 0.3 },
                { name: 'GRU', r2: 0.9819, rmse: 0.0261, color: 'orange', weight: 0.4 },
                { name: 'Ensemble', r2: 0.9900, rmse: 0.0180, color: 'emerald', weight: 1.0 },
              ].map((m) => {
                const isEns = m.name === 'Ensemble'
                return (
                  <div
                    key={m.name}
                    className={`rounded-lg p-3 border ${
                      isEns
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-700/40 border-slate-600/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${isEns ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {m.name}
                      </span>
                      <span className="text-[10px] text-slate-500">w={m.weight}</span>
                    </div>
                    <p className="text-xl font-bold text-white">R² {m.r2.toFixed(4)}</p>
                    <p className="text-xs text-slate-500 mt-1">RMSE {m.rmse.toFixed(4)}</p>
                    <div className="w-full h-1.5 bg-slate-600 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isEns ? 'bg-emerald-400' : 'bg-slate-400'
                        }`}
                        style={{ width: `${m.r2 * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              Outputs from CNN, LSTM, and GRU are combined via weighted average (0.3 / 0.3 / 0.4) into a
              single ensemble prediction. The ensemble achieves <span className="text-emerald-400 font-semibold">R²=0.99</span>{' '}
              on the held-out test set, exceeding the 90% accuracy target.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
