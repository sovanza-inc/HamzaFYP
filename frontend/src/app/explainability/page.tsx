'use client'

import { useState } from 'react'
import {
  Lightbulb,
  RefreshCw,
  AlertCircle,
  Info,
  GitCompareArrows,
  Database,
  Brain,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  MapPin,
  Calendar,
  Play,
  CheckCircle,
} from 'lucide-react'
import { compareInsights } from '@/src/lib/api'

const MODELS = ['Ensemble', 'CNN', 'LSTM', 'GRU']
const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Multan', 'Peshawar', 'Skardu']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface FactorEntry {
  feature: string
  importance: number
  direction: string
  explanation: string
}
interface InsightSide {
  city: string
  month: number
  month_name: string
  season: string
  drivers: string[]
  avg_daily_kwh: number
  peak_daily_kwh: number
  lowest_daily_kwh: number
  monthly_total_kwh: number
  city_baseline_kwh: number
  factors: FactorEntry[]
}
interface CompareInsightsResponse {
  a: InsightSide
  b: InsightSide
  diff_kwh: number
  diff_pct: number
  higher: string
  lower: string
  narrative: string
  factor_diffs: Array<{ feature: string; delta_importance: number; winner: string; note: string }>
  data_sources: string[]
  model_summary: string
}

function SidePanel({
  side,
  color,
  isHigher,
}: {
  side: InsightSide
  color: 'emerald' | 'blue'
  isHigher: boolean
}) {
  const bg = color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-blue-500/5 border-blue-500/30'
  const accent = color === 'emerald' ? 'text-emerald-400' : 'text-blue-400'
  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className={`text-sm font-bold ${accent} flex items-center gap-1.5`}>
            <MapPin className="w-3.5 h-3.5" /> {side.city}
          </div>
          <div className="text-white text-lg font-semibold mt-0.5">{side.month_name}</div>
          <div className="text-xs text-slate-500">Season: {side.season}</div>
        </div>
        {isHigher && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Higher
          </span>
        )}
        {!isHigher && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Lower
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-800/60 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Avg/day</div>
          <div className="text-white font-bold text-lg">{side.avg_daily_kwh.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500">kWh</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Peak</div>
          <div className="text-white font-bold text-lg">{side.peak_daily_kwh.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500">kWh</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Monthly</div>
          <div className="text-white font-bold text-lg">{(side.monthly_total_kwh / 1000).toFixed(2)}k</div>
          <div className="text-[10px] text-slate-500">kWh</div>
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-400 font-medium mb-2">Top drivers</div>
        <div className="flex flex-wrap gap-1.5">
          {side.drivers.map((d) => (
            <span
              key={d}
              className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ExplainabilityPage() {
  const [model, setModel] = useState('Ensemble')
  const [city1, setCity1] = useState('Lahore')
  const [month1, setMonth1] = useState(7) // July
  const [city2, setCity2] = useState('Skardu')
  const [month2, setMonth2] = useState(1) // January
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CompareInsightsResponse | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await compareInsights(city1, month1, city2, month2)
      setData(res.data as CompareInsightsResponse)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Backend unreachable: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const aIsHigher = data ? data.a.avg_daily_kwh >= data.b.avg_daily_kwh : false

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Explainability</h1>
        <p className="text-slate-400 mt-1">
          Compare any two cities and months — see what drives the difference and why the model predicts what it predicts
        </p>
      </div>

      {/* Configuration */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <GitCompareArrows className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Configure Comparison</h2>
            <p className="text-xs text-slate-500">Pick a model, then two (city, month) pairs to analyze side-by-side</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Model */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1.5 flex items-center gap-1">
              <Brain className="w-3 h-3" /> Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Side A */}
          <div>
            <label className="text-xs text-emerald-400 font-medium mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> City A
            </label>
            <select
              value={city1}
              onChange={(e) => setCity1(e.target.value)}
              className="w-full bg-slate-700 border border-emerald-500/30 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-emerald-400 font-medium mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Month A
            </label>
            <select
              value={month1}
              onChange={(e) => setMonth1(parseInt(e.target.value))}
              className="w-full bg-slate-700 border border-emerald-500/30 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Side B */}
          <div>
            <label className="text-xs text-blue-400 font-medium mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> City B
            </label>
            <select
              value={city2}
              onChange={(e) => setCity2(e.target.value)}
              className="w-full bg-slate-700 border border-blue-500/30 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-blue-400 font-medium mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Month B
            </label>
            <select
              value={month2}
              onChange={(e) => setMonth2(parseInt(e.target.value))}
              className="w-full bg-slate-700 border border-blue-500/30 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Quick presets:</span>
            <button
              onClick={() => { setCity1('Lahore'); setMonth1(7); setCity2('Lahore'); setMonth2(1) }}
              className="px-2.5 py-0.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300"
            >
              Lahore: Summer vs Winter
            </button>
            <button
              onClick={() => { setCity1('Karachi'); setMonth1(7); setCity2('Skardu'); setMonth2(7) }}
              className="px-2.5 py-0.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300"
            >
              Coast vs Mountain (July)
            </button>
            <button
              onClick={() => { setCity1('Multan'); setMonth1(6); setCity2('Islamabad'); setMonth2(6) }}
              className="px-2.5 py-0.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300"
            >
              Hot south vs Capital (June)
            </button>
          </div>
          <button
            onClick={handleRun}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-5 py-2.5 text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Run Analysis
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {!data && !loading && (
        <div className="bg-slate-800/60 border border-dashed border-slate-700 rounded-xl p-8 text-center">
          <Lightbulb className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">Pick two (city, month) pairs and click Run Analysis</p>
          <p className="text-slate-500 text-xs mt-1">
            Try presets above — Lahore Summer vs Winter is a great starting point
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Side-by-side panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SidePanel side={data.a} color="emerald" isHigher={aIsHigher} />
            <SidePanel side={data.b} color="blue" isHigher={!aIsHigher} />
          </div>

          {/* Headline difference */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Difference
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl font-bold text-white">{Math.abs(data.diff_pct).toFixed(1)}%</span>
              <ArrowRight className="w-5 h-5 text-slate-500" />
              <span className="text-emerald-400 font-semibold">{data.higher}</span>
              <span className="text-slate-500">consumes more than</span>
              <span className="text-blue-400 font-semibold">{data.lower}</span>
              <span className="text-slate-500 text-sm">
                (Δ {Math.abs(data.diff_kwh).toFixed(2)} kWh/day)
              </span>
            </div>
          </div>


          {/* Narrative explanation */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Why the difference?
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">{data.narrative}</p>
          </div>

          {/* Per-side factor explanations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[data.a, data.b].map((side, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-5 ${
                  idx === 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-blue-500/5 border-blue-500/20'
                }`}
              >
                <h4 className={`font-semibold mb-3 ${idx === 0 ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {side.city} · {side.month_name} — Top factor explanations
                </h4>
                <div className="space-y-2.5">
                  {side.factors.slice(0, 4).map((f) => (
                    <div key={f.feature} className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          {f.feature}
                        </span>
                        <span className="text-xs text-slate-500">
                          {(f.importance * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{f.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Data sources & model info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                Where the data comes from
              </h3>
              <ul className="space-y-2.5">
                {data.data_sources.map((src, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{src}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                How the model produces results
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{data.model_summary}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-700/40 rounded-lg p-2 border border-slate-600/40">
                  <div className="text-emerald-400 text-sm font-bold">CNN</div>
                  <div className="text-[10px] text-slate-500">w=0.3 · R²=0.99</div>
                </div>
                <div className="bg-slate-700/40 rounded-lg p-2 border border-slate-600/40">
                  <div className="text-emerald-400 text-sm font-bold">LSTM</div>
                  <div className="text-[10px] text-slate-500">w=0.3 · R²=0.98</div>
                </div>
                <div className="bg-slate-700/40 rounded-lg p-2 border border-slate-600/40">
                  <div className="text-emerald-400 text-sm font-bold">GRU</div>
                  <div className="text-[10px] text-slate-500">w=0.4 · R²=0.98</div>
                </div>
              </div>
            </div>
          </div>

          {/* Info banner with definitions */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="text-blue-400 font-semibold">How to read this:</span> Each factor&apos;s
              importance shows how much that feature shifted the model&apos;s prediction for that
              (city, month). A higher value for <span className="font-mono text-emerald-400">temperature</span> in
              summer months simply means the model relies on temperature more when temperatures are extreme.
              The lag features (<span className="font-mono">lag_1d</span>, <span className="font-mono">rolling_mean_7d</span>)
              encode recent consumption history, which is why predictions stay smooth across consecutive days.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
