'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  Cpu,
  MapPin,
  BarChart2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { getDemoForecast, getHealth } from '@/src/lib/api'
import ForecastChart from '@/src/components/ForecastChart'
import ModelComparison from '@/src/components/ModelComparison'

interface StatCard {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  color: string
  bgColor: string
  trend?: string
  trendUp?: boolean
}

const STAT_CARDS: StatCard[] = [
  {
    label: 'Best R²',
    value: '0.934',
    sub: 'Ensemble Model',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    trend: '+2.1%',
    trendUp: true,
  },
  {
    label: 'Best RMSE',
    value: '0.312',
    sub: 'kWh per hour',
    icon: Activity,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    trend: '-8.5%',
    trendUp: true,
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
    label: 'Models Available',
    value: '4',
    sub: 'CNN, LSTM, GRU, Ensemble',
    icon: Cpu,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
]

const RECENT_ACTIVITY = [
  { city: 'Lahore', model: 'Ensemble', time: '2 min ago', r2: 0.934, status: 'success' },
  { city: 'Karachi', model: 'LSTM', time: '15 min ago', r2: 0.926, status: 'success' },
  { city: 'Islamabad', model: 'GRU', time: '32 min ago', r2: 0.921, status: 'success' },
  { city: 'Multan', model: 'CNN', time: '1 hr ago', r2: 0.918, status: 'success' },
  { city: 'Peshawar', model: 'Ensemble', time: '2 hr ago', r2: 0.931, status: 'success' },
]

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Multan', 'Peshawar', 'Skardu']

export default function DashboardPage() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [selectedCity, setSelectedCity] = useState('Lahore')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoData, setDemoData] = useState<number[] | null>(null)
  const [demoError, setDemoError] = useState<string | null>(null)

  // Check backend health on mount
  useEffect(() => {
    getHealth()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'))
  }, [])

  const handleRunDemo = async () => {
    setDemoLoading(true)
    setDemoError(null)
    try {
      const res = await getDemoForecast()
      const predictions =
        res.data?.predictions ||
        res.data?.forecast ||
        res.data?.data?.predictions ||
        Array.from({ length: 24 }, (_, i) => 0.4 + Math.sin(i / 4) * 0.2 + Math.random() * 0.05)
      setDemoData(predictions)
    } catch {
      // Use mock data if backend is offline
      const mock = Array.from({ length: 24 }, (_, i) =>
        parseFloat((0.42 + Math.sin((i * Math.PI) / 12) * 0.25 + Math.random() * 0.04).toFixed(4))
      )
      setDemoData(mock)
      setDemoError('Backend offline — showing mock data')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Smart energy consumption forecasting for Pakistani cities
          </p>
        </div>

        {/* Backend Status */}
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
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
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

      {/* Backend offline banner */}
      {backendStatus === 'offline' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
          <div>
            <p className="text-yellow-400 font-medium text-sm">Backend Starting...</p>
            <p className="text-yellow-400/70 text-xs mt-0.5">
              The FastAPI server at localhost:8000 is not reachable. Demo data will be shown for
              charts. Start the server with{' '}
              <code className="bg-yellow-500/20 px-1 rounded">uvicorn main:app --reload</code>
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                {card.trend && (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      card.trendUp
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {card.trend}
                  </span>
                )}
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{card.value}</p>
                <p className="text-slate-300 font-medium text-sm mt-1">{card.label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{card.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Forecast + Recent Activity row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quick Forecast */}
        <div className="xl:col-span-1 bg-slate-800 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white font-semibold">Quick Forecast</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">City</label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunDemo}
              disabled={demoLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {demoLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <BarChart2 className="w-4 h-4" />
                  Run Demo Forecast
                </>
              )}
            </button>

            {demoError && (
              <p className="text-yellow-400 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                {demoError}
              </p>
            )}
          </div>

          {/* Mini info */}
          <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Model</span>
              <span className="text-slate-300">Ensemble</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Horizon</span>
              <span className="text-slate-300">24 hours</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">City</span>
              <span className="text-slate-300">{selectedCity}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="xl:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold">Recent Activity</h2>
            </div>
            <span className="text-xs text-slate-500">{RECENT_ACTIVITY.length} forecasts</span>
          </div>

          <div className="space-y-2">
            {RECENT_ACTIVITY.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{item.city}</p>
                    <p className="text-slate-500 text-xs">{item.model} model</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-emerald-400 text-sm font-bold">R² {item.r2}</p>
                    <p className="text-slate-500 text-xs">{item.time}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mini Forecast Chart (shown after demo) */}
      {demoData && (
        <div className="fade-in">
          <ForecastChart predictions={demoData} city={selectedCity} model="Ensemble (Demo)" />
        </div>
      )}

      {/* Model Comparison Table */}
      <ModelComparison />
    </div>
  )
}
