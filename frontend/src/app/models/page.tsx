'use client'

import { useState, useEffect } from 'react'
import { Brain, AlertCircle, RefreshCw, Terminal, Layers } from 'lucide-react'
import { getModels } from '@/src/lib/api'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface ModelInfo {
  name: string
  type: string
  r2: number
  rmse: number
  mae: number
  status: 'trained' | 'mock'
  description: string
}

const MODEL_COLORS: Record<string, string> = {
  Ensemble: '#10b981',
  CNN: '#3b82f6',
  LSTM: '#a855f7',
  GRU: '#f97316',
}

const MODEL_DESCRIPTIONS: Record<string, string> = {
  Ensemble: 'Combines CNN, LSTM, and GRU predictions via learned weighting for maximum accuracy. Robust against individual model weaknesses and generalizes well across all city profiles.',
  CNN: 'Convolutional Neural Network extracts local temporal patterns via 1-D convolutions. Excels at detecting short-term spikes and periodic energy cycles within the 24-hour window.',
  LSTM: 'Long Short-Term Memory network captures long-range dependencies in energy consumption sequences. Maintains memory of multi-day trends, seasonal patterns, and weather lag effects.',
  GRU: 'Gated Recurrent Unit offers similar sequence modelling to LSTM with fewer parameters, resulting in faster inference and lower memory footprint without significant accuracy loss.',
}

const ARCHITECTURE: Record<string, string[]> = {
  CNN: ['Input (24×21)', '→ Conv1D(64, k=3) + ReLU', '→ Conv1D(128, k=3) + ReLU', '→ GlobalAvgPool1D', '→ Dense(64) + Dropout(0.2)', '→ Dense(1) [output]'],
  LSTM: ['Input (24×21)', '→ LSTM(128, return_seq=True)', '→ LSTM(64)', '→ Dense(32) + Dropout(0.2)', '→ Dense(1) [output]'],
  GRU: ['Input (24×21)', '→ GRU(128, return_seq=True)', '→ GRU(64)', '→ Dense(32) + Dropout(0.2)', '→ Dense(1) [output]'],
  Ensemble: ['CNN branch (above)', '+ LSTM branch (above)', '+ GRU branch (above)', '→ Weighted Average (0.3 / 0.3 / 0.4)', '→ Scalar output [kWh]'],
}

const FALLBACK_MODELS: ModelInfo[] = [
  { name: 'Ensemble', type: 'Hybrid', r2: 0.9900, rmse: 0.0180, mae: 0.011, status: 'trained', description: MODEL_DESCRIPTIONS.Ensemble },
  { name: 'CNN', type: 'Convolutional', r2: 0.9912, rmse: 0.0182, mae: 0.011, status: 'trained', description: MODEL_DESCRIPTIONS.CNN },
  { name: 'LSTM', type: 'Recurrent', r2: 0.9833, rmse: 0.0251, mae: 0.016, status: 'trained', description: MODEL_DESCRIPTIONS.LSTM },
  { name: 'GRU', type: 'Recurrent', r2: 0.9819, rmse: 0.0261, mae: 0.017, status: 'trained', description: MODEL_DESCRIPTIONS.GRU },
]

function r2Color(r2: number) {
  if (r2 >= 0.93) return 'text-emerald-400'
  if (r2 >= 0.90) return 'text-yellow-400'
  return 'text-red-400'
}

function StatusBadge({ status }: { status: 'trained' | 'mock' }) {
  if (status === 'trained') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
        Ready
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
      Ready (Mock)
    </span>
  )
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(value * 100, 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

function ArchDiagram({ model }: { model: string }) {
  const layers = ARCHITECTURE[model] ?? []
  return (
    <div className="mt-4 space-y-1.5">
      {layers.map((layer, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded px-3 py-1.5 text-xs text-slate-300 font-mono">
            {layer}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedArch, setExpandedArch] = useState<string | null>(null)

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await getModels()
        const data = res.data
        const rawModels = Array.isArray(data) ? data : Array.isArray(data?.models) ? data.models : []

        if (rawModels.length === 0) {
          setModels(FALLBACK_MODELS)
          setError('No model data returned from API. Showing default model info.')
          return
        }

        const parsed: ModelInfo[] = rawModels.map((m: Record<string, unknown>) => ({
          name: String(m.name ?? m.model_name ?? ''),
          type: String(m.type ?? m.model_type ?? 'Neural Network'),
          r2: Number(m.r2 ?? m.r2_score ?? 0),
          rmse: Number(m.rmse ?? 0),
          mae: Number(m.mae ?? 0),
          status: m.trained || m.status === 'trained' ? 'trained' : 'mock',
          description: String(m.description ?? MODEL_DESCRIPTIONS[String(m.name ?? '')] ?? ''),
        }))
        setModels(parsed)
      } catch {
        setError('Backend unreachable. Showing default model information.')
        setModels(FALLBACK_MODELS)
      } finally {
        setLoading(false)
      }
    }
    fetchModels()
  }, [])

  // Radar chart data
  const radarData = [
    { metric: 'R²', ...Object.fromEntries(models.map((m) => [m.name, parseFloat((m.r2 * 100).toFixed(1))])) },
    { metric: '1-RMSE', ...Object.fromEntries(models.map((m) => [m.name, parseFloat(((1 - m.rmse) * 100).toFixed(1))])) },
    { metric: '1-MAE', ...Object.fromEntries(models.map((m) => [m.name, parseFloat(((1 - m.mae) * 100).toFixed(1))])) },
  ]

  const FILL_OPACITY = 0.15

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-emerald-400" />
          Models
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Deep learning models for 24-hour energy demand forecasting
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="text-yellow-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-6 animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="h-6 w-24 bg-slate-700 rounded" />
                <div className="h-5 w-20 bg-slate-700 rounded-full" />
              </div>
              <div className="h-10 w-20 bg-slate-700 rounded" />
              <div className="h-4 w-full bg-slate-700 rounded" />
              <div className="h-2 w-full bg-slate-700 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Model cards 2x2 */}
      {!loading && models.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {models.map((m) => (
            <div
              key={m.name}
              className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-slate-600 transition-colors"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg leading-none">{m.name}</h3>
                  <span className="text-xs text-slate-400 mt-1 inline-block">{m.type}</span>
                </div>
                <StatusBadge status={m.status} />
              </div>

              {/* R2 large */}
              <div className="mb-1">
                <span className={`text-4xl font-bold ${r2Color(m.r2)}`}>{m.r2.toFixed(3)}</span>
                <span className="text-slate-500 text-sm ml-1">R²</span>
              </div>

              {/* RMSE / MAE */}
              <div className="flex gap-4 text-xs text-slate-400 mb-4">
                <span>RMSE <strong className="text-slate-300">{m.rmse.toFixed(4)}</strong></span>
                <span>MAE <strong className="text-slate-300">{m.mae.toFixed(4)}</strong></span>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>R² Score</span>
                  <span>{(m.r2 * 100).toFixed(1)}%</span>
                </div>
                <ProgressBar value={m.r2} color={MODEL_COLORS[m.name] ?? '#10b981'} />
              </div>

              {/* Description */}
              <p className="text-slate-400 text-xs leading-relaxed mb-4">{m.description}</p>

              {/* Architecture toggle */}
              <button
                onClick={() => setExpandedArch(expandedArch === m.name ? null : m.name)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                {expandedArch === m.name ? 'Hide' : 'Show'} Architecture
              </button>
              {expandedArch === m.name && <ArchDiagram model={m.name} />}
            </div>
          ))}
        </div>
      )}

      {/* Radar chart */}
      {!loading && models.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
            <Brain className="w-4 h-4 text-emerald-400" />
            Model Comparison Radar
          </h2>
          <p className="text-slate-400 text-xs mb-5">All metrics normalized to 0–100 scale (higher is better)</p>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[80, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
              {models.map((m) => (
                <Radar
                  key={m.name}
                  name={m.name}
                  dataKey={m.name}
                  stroke={MODEL_COLORS[m.name] ?? '#10b981'}
                  fill={MODEL_COLORS[m.name] ?? '#10b981'}
                  fillOpacity={FILL_OPACITY}
                  strokeWidth={2}
                />
              ))}
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* How to train */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          How to Train Models
        </h2>
        <p className="text-slate-400 text-xs mb-4">
          Run the following commands from the project root to train each model:
        </p>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 font-mono text-sm space-y-2 overflow-x-auto">
          <div>
            <span className="text-slate-500 select-none"># Train individual models</span>
          </div>
          <div>
            <span className="text-emerald-400">python</span>{' '}
            <span className="text-slate-300">train.py</span>{' '}
            <span className="text-blue-400">--model cnn</span>{' '}
            <span className="text-purple-400">--city all</span>
          </div>
          <div>
            <span className="text-emerald-400">python</span>{' '}
            <span className="text-slate-300">train.py</span>{' '}
            <span className="text-blue-400">--model lstm</span>{' '}
            <span className="text-purple-400">--city all</span>
          </div>
          <div>
            <span className="text-emerald-400">python</span>{' '}
            <span className="text-slate-300">train.py</span>{' '}
            <span className="text-blue-400">--model ensemble</span>{' '}
            <span className="text-purple-400">--city all</span>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-3">
          Trained <code className="bg-slate-700 px-1 rounded text-slate-300">.keras</code> files are saved to{' '}
          <code className="bg-slate-700 px-1 rounded text-slate-300">backend/models/</code>. A{' '}
          <span className="text-amber-400">Ready (Mock)</span> badge means the model file was not found and
          the backend falls back to synthetic weights.
        </p>
      </div>
    </div>
  )
}
