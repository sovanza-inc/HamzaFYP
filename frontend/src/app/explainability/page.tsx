'use client'

import { useState } from 'react'
import { Lightbulb, RefreshCw, AlertCircle, ChevronDown, Info } from 'lucide-react'
import { getShapGlobal, getShapLocal, getLime } from '@/src/lib/api'
import { ShapBarChart, ShapWaterfallChart, LimeChart } from '@/src/components/XAIPanel'

type Tab = 'global-shap' | 'local-shap' | 'lime'

const MODELS = ['Ensemble', 'CNN', 'LSTM', 'GRU']

// Mock data for offline / fallback display
const MOCK_SHAP_GLOBAL = [
  { feature: 'temperature', importance: 0.1823 },
  { feature: 'lag_1h', importance: 0.1654 },
  { feature: 'lag_24h', importance: 0.1421 },
  { feature: 'solar_radiation', importance: 0.1187 },
  { feature: 'lag_1d', importance: 0.0943 },
  { feature: 'humidity', importance: 0.0812 },
  { feature: 'hour_sin', importance: 0.0721 },
  { feature: 'hour_cos', importance: 0.0634 },
  { feature: 'is_weekend', importance: 0.0412 },
  { feature: 'wind_speed', importance: 0.0393 },
]

const MOCK_SHAP_LOCAL = [
  { feature: 'temperature', shap_value: 0.0842, direction: 'positive' },
  { feature: 'lag_1h', shap_value: 0.0731, direction: 'positive' },
  { feature: 'solar_radiation', shap_value: -0.0612, direction: 'negative' },
  { feature: 'lag_24h', shap_value: 0.0521, direction: 'positive' },
  { feature: 'humidity', shap_value: -0.0487, direction: 'negative' },
  { feature: 'lag_1d', shap_value: 0.0341, direction: 'positive' },
  { feature: 'hour_sin', shap_value: -0.0298, direction: 'negative' },
  { feature: 'is_weekend', shap_value: -0.0187, direction: 'negative' },
]

const MOCK_LIME = [
  { feature: 'temperature > 35°C', weight: 0.0934 },
  { feature: 'lag_1h > 0.6 kWh', weight: 0.0821 },
  { feature: 'solar_radiation low', weight: -0.0712 },
  { feature: 'lag_24h > 0.55', weight: 0.0634 },
  { feature: 'humidity > 70%', weight: -0.0521 },
  { feature: 'is_weekend = True', weight: -0.0398 },
  { feature: 'hour_cos > 0.5', weight: -0.0312 },
  { feature: 'wind_speed < 10', weight: 0.0287 },
]

const TAB_LABELS: { id: Tab; label: string; description: string }[] = [
  {
    id: 'global-shap',
    label: 'Global SHAP',
    description: 'Average feature importance across all predictions',
  },
  {
    id: 'local-shap',
    label: 'Local SHAP',
    description: 'SHAP values for a specific prediction instance',
  },
  {
    id: 'lime',
    label: 'LIME',
    description: 'Local linear approximation explanation',
  },
]

export default function ExplainabilityPage() {
  const [activeTab, setActiveTab] = useState<Tab>('global-shap')
  const [model, setModel] = useState('Ensemble')
  const [instanceIdx, setInstanceIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [shapGlobalData, setShapGlobalData] = useState<
    Array<{ feature: string; importance: number }>
  >(MOCK_SHAP_GLOBAL)
  const [shapLocalData, setShapLocalData] = useState<
    Array<{ feature: string; shap_value: number; direction: string }>
  >(MOCK_SHAP_LOCAL)
  const [limeData, setLimeData] = useState<Array<{ feature: string; weight: number }>>(MOCK_LIME)

  const [computed, setComputed] = useState(false)

  // Mock input sequence for API calls
  const MOCK_INPUT = Array.from({ length: 24 }, () =>
    Array.from({ length: 10 }, () => Math.random())
  )
  const FEATURE_NAMES = [
    'temperature',
    'humidity',
    'solar_radiation',
    'wind_speed',
    'lag_1h',
    'lag_24h',
    'lag_1d',
    'hour_sin',
    'hour_cos',
    'is_weekend',
  ]

  const handleCompute = async () => {
    setLoading(true)
    setError(null)

    try {
      if (activeTab === 'global-shap') {
        const res = await getShapGlobal(model)
        const raw = res.data?.shap_values || res.data?.feature_importance || res.data
        if (Array.isArray(raw)) {
          setShapGlobalData(raw)
        }
      } else if (activeTab === 'local-shap') {
        const res = await getShapLocal(model, instanceIdx, MOCK_INPUT)
        const raw = res.data?.shap_values || res.data
        if (Array.isArray(raw)) {
          setShapLocalData(raw)
        }
      } else {
        const res = await getLime(model, MOCK_INPUT, FEATURE_NAMES)
        const raw = res.data?.lime_weights || res.data
        if (Array.isArray(raw)) {
          setLimeData(raw)
        }
      }
      setComputed(true)
    } catch {
      setError('Backend unreachable — showing pre-computed example data.')
      setComputed(true)
    } finally {
      setLoading(false)
    }
  }

  const buttonLabel =
    activeTab === 'global-shap'
      ? 'Compute Global SHAP'
      : activeTab === 'local-shap'
      ? 'Explain Instance'
      : 'Compute LIME'

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Explainability</h1>
        <p className="text-slate-400 mt-1">
          Understand what drives predictions using SHAP and LIME techniques
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-400 text-sm font-medium">About XAI Methods</p>
          <p className="text-blue-400/70 text-xs mt-1">
            <strong>SHAP</strong> (SHapley Additive exPlanations) attributes each feature&apos;s
            contribution to the prediction. <strong>LIME</strong> (Local Interpretable
            Model-agnostic Explanations) builds a local linear approximation around each prediction.
            Pre-computed example data is shown below — click &quot;Compute&quot; to run live analysis.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {/* Tab Bar */}
        <div className="flex border-b border-slate-700">
          {TAB_LABELS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setError(null)
              }}
              className={`flex-1 px-5 py-4 text-sm font-medium transition-colors text-center ${
                activeTab === tab.id
                  ? 'bg-slate-700/50 text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab description */}
        <div className="px-5 py-3 bg-slate-900/50 border-b border-slate-700">
          <p className="text-slate-400 text-xs">
            {TAB_LABELS.find((t) => t.id === activeTab)?.description}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="p-5">
          <div className="flex flex-wrap items-end gap-4 mb-5">
            {/* Model Selector */}
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Model</label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 pr-8 min-w-[140px]"
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

            {/* Instance Index (Local SHAP only) */}
            {activeTab === 'local-shap' && (
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  Instance Index
                </label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={instanceIdx}
                  onChange={(e) => setInstanceIdx(parseInt(e.target.value) || 0)}
                  className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 w-32"
                />
              </div>
            )}

            {/* Compute Button */}
            <button
              onClick={handleCompute}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-5 py-2.5 text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Computing...
                </>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4" />
                  {buttonLabel}
                </>
              )}
            </button>

            {computed && !loading && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                {error ? 'Example data' : 'Live computation'}
              </span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
              <p className="text-yellow-400 text-xs">{error}</p>
            </div>
          )}

          {/* Chart */}
          {activeTab === 'global-shap' && <ShapBarChart data={shapGlobalData} />}
          {activeTab === 'local-shap' && <ShapWaterfallChart data={shapLocalData} />}
          {activeTab === 'lime' && <LimeChart data={limeData} />}
        </div>
      </div>

      {/* Feature Description */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          Feature Descriptions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: 'temperature', desc: 'Hourly temperature in °C' },
            { name: 'humidity', desc: 'Relative humidity (%)' },
            { name: 'solar_radiation', desc: 'Solar irradiance (W/m²)' },
            { name: 'wind_speed', desc: 'Wind speed (km/h)' },
            { name: 'lag_1h', desc: 'Energy consumption 1 hour ago' },
            { name: 'lag_24h', desc: 'Energy consumption 24 hours ago' },
            { name: 'lag_1d', desc: 'Smoothed daily lag consumption' },
            { name: 'hour_sin', desc: 'Sine encoding of hour of day' },
            { name: 'hour_cos', desc: 'Cosine encoding of hour of day' },
            { name: 'is_weekend', desc: 'Binary weekend indicator' },
          ].map((f) => (
            <div key={f.name} className="flex items-start gap-2 p-3 bg-slate-700/50 rounded-lg">
              <span className="text-xs font-mono text-emerald-400 font-semibold shrink-0 mt-0.5 min-w-[90px]">
                {f.name}
              </span>
              <span className="text-xs text-slate-400">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
