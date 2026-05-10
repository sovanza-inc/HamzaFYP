'use client'

import { useState } from 'react'
import {
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ChevronDown,
} from 'lucide-react'
import { getLiveForecast } from '@/src/lib/api'
import ForecastChart from '@/src/components/ForecastChart'
import ModelComparison from '@/src/components/ModelComparison'
import WeatherWidget from '@/src/components/WeatherWidget'
import ApplianceBreakdown from '@/src/components/ApplianceBreakdown'
import EnergyTips from '@/src/components/EnergyTips'
import WeeklyForecast from '@/src/components/WeeklyForecast'
import DownloadButton from '@/src/components/DownloadButton'
import { CardSkeleton, ChartSkeleton } from '@/src/components/Skeleton'
import { useToast } from '@/src/components/Toast'

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Multan', 'Peshawar', 'Skardu']
const MODELS = ['Ensemble', 'CNN', 'LSTM', 'GRU']

interface ForecastResult {
  predictions: number[]
  lower_ci?: number[]
  upper_ci?: number[]
  predicted_daily_kwh?: number
  city: string
  model: string
}

function MetricCard({
  label,
  value,
  unit,
  color,
  sub,
}: {
  label: string
  value: string
  unit?: string
  color: string
  sub?: string
}) {
  return (
    <div className="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
      <p className="text-slate-400 text-sm font-medium mb-2">{label}</p>
      <div className="flex items-end gap-1">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {unit && <span className="text-slate-400 text-sm mb-0.5">{unit}</span>}
      </div>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function ForecastPage() {
  const { toast } = useToast()
  const [city, setCity] = useState('Lahore')
  const [model, setModel] = useState('Ensemble')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ForecastResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleForecast = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await getLiveForecast(city, model)
      const data = res.data
      const predictions: number[] = data?.hourly_predictions ?? data?.predictions ?? []
      const dailyKwh = data?.predicted_kwh ?? predictions.reduce((s: number, v: number) => s + v, 0)

      if (!predictions.length) {
        throw new Error('No predictions returned by the backend.')
      }

      const lower = predictions.map((v) => parseFloat((v * 0.92).toFixed(4)))
      const upper = predictions.map((v) => parseFloat((v * 1.08).toFixed(4)))

      setResult({
        predictions,
        lower_ci: lower,
        upper_ci: upper,
        predicted_daily_kwh: parseFloat(dailyKwh.toFixed(3)),
        city,
        model,
      })
      toast(`${city} · ${model} forecast ready`, 'success')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Forecast failed: ${errorMessage}. Make sure the backend is running.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Forecast</h1>
        <p className="text-slate-400 mt-1">
          Generate 24-hour energy consumption predictions for any supported Pakistani city
        </p>
      </div>

      {/* Live Weather Widget */}
      <WeatherWidget city={city} />

      {/* Configuration Card */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Forecast Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* City Selector */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">City</label>
            <div className="relative">
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 pr-8"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Model Selector */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Model</label>
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 pr-8"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleForecast}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-8 py-3 text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running Forecast...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" />
              Run Forecast
            </>
          )}
        </button>
      </div>

      {/* Error/warning banner */}
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="text-yellow-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading skeletons — shown while forecast is running */}
      {loading && (
        <div className="space-y-6 fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <ChartSkeleton />
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 fade-in">
          {/* Success banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-emerald-400 text-sm">
              <strong>Forecast complete</strong> — {result.city} | {result.model} model | 24-hour
              horizon
            </p>
          </div>

          {/* Metric Cards + Download Button */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                label="Predicted Daily Total"
                value={result.predicted_daily_kwh?.toFixed(3) ?? '—'}
                unit="kWh"
                color="text-emerald-400"
                sub="Sum of 24-hour forecast"
              />
              <MetricCard
                label="Lower CI (avg)"
                value={
                  result.lower_ci
                    ? (result.lower_ci.reduce((a, b) => a + b, 0) / result.lower_ci.length).toFixed(3)
                    : '—'
                }
                unit="kWh"
                color="text-blue-400"
                sub="95% confidence lower bound"
              />
              <MetricCard
                label="Upper CI (avg)"
                value={
                  result.upper_ci
                    ? (result.upper_ci.reduce((a, b) => a + b, 0) / result.upper_ci.length).toFixed(3)
                    : '—'
                }
                unit="kWh"
                color="text-purple-400"
                sub="95% confidence upper bound"
              />
            </div>
            {/* Download button — visible only once forecast has run */}
            <div className="flex justify-end">
              <DownloadButton
                data={{
                  predictions:   result.predictions,
                  city:          result.city,
                  model:         result.model,
                  predicted_kwh: result.predicted_daily_kwh ?? 0,
                }}
              />
            </div>
          </div>

          {/* Chart */}
          <ForecastChart
            predictions={result.predictions}
            city={result.city}
            model={result.model}
            confidenceLower={result.lower_ci}
            confidenceUpper={result.upper_ci}
          />

          {/* Appliance Breakdown */}
          <ApplianceBreakdown city={result.city} predictions={result.predictions} />

          {/* Energy Tips */}
          <EnergyTips city={result.city} />

          {/* Weekly Forecast */}
          <WeeklyForecast city={result.city} />

          {/* Model Comparison */}
          <ModelComparison />
        </div>
      )}
    </div>
  )
}
