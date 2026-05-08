'use client'

import { Trophy, TrendingDown, TrendingUp } from 'lucide-react'

interface ModelData {
  name: string
  rmse: number
  mae: number
  r2: number
}

interface ModelComparisonProps {
  modelsData?: ModelData[]
}

const DEFAULT_MODELS: ModelData[] = [
  { name: 'CNN', rmse: 0.341, mae: 0.261, r2: 0.918 },
  { name: 'LSTM', rmse: 0.328, mae: 0.248, r2: 0.924 },
  { name: 'GRU', rmse: 0.335, mae: 0.255, r2: 0.921 },
  { name: 'Ensemble', rmse: 0.312, mae: 0.237, r2: 0.934 },
]

function getR2Color(r2: number): string {
  if (r2 >= 0.93) return 'text-emerald-400'
  if (r2 >= 0.9) return 'text-yellow-400'
  return 'text-red-400'
}

function getR2Badge(r2: number): string {
  if (r2 >= 0.93) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (r2 >= 0.9) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  return 'bg-red-500/10 text-red-400 border-red-500/20'
}

export default function ModelComparison({ modelsData }: ModelComparisonProps) {
  const models = modelsData ?? DEFAULT_MODELS
  const bestModel = models.reduce((best, m) => (m.r2 > best.r2 ? m : best), models[0])

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Model Comparison</h3>
          <p className="text-slate-400 text-sm">Performance metrics across all models</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
          <Trophy className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400 text-xs font-medium">Best: {bestModel.name}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-slate-700">
              <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Model
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">
                <div className="flex items-center justify-end gap-1">
                  <TrendingDown className="w-3 h-3" />
                  RMSE
                </div>
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">
                <div className="flex items-center justify-end gap-1">
                  <TrendingDown className="w-3 h-3" />
                  MAE
                </div>
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">
                <div className="flex items-center justify-end gap-1">
                  <TrendingUp className="w-3 h-3" />
                  R²
                </div>
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {models.map((model, idx) => {
              const isBest = model.name === bestModel.name
              return (
                <tr
                  key={model.name}
                  className={`border-b border-slate-700/50 transition-colors hover:bg-slate-700/30 ${
                    isBest ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {isBest && <Trophy className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      <span
                        className={`font-semibold text-sm ${
                          isBest ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {model.name}
                      </span>
                      {isBest && (
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Best
                        </span>
                      )}
                      {!isBest && (
                        <span className="text-xs text-slate-500">#{idx + 1}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-slate-200 text-sm font-mono">
                      {model.rmse.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-slate-200 text-sm font-mono">
                      {model.mae.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span
                      className={`text-sm font-bold font-mono ${getR2Color(model.r2)}`}
                    >
                      {model.r2.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded-full border font-medium ${getR2Badge(
                        model.r2
                      )}`}
                    >
                      {model.r2 >= 0.93 ? 'Excellent' : model.r2 >= 0.9 ? 'Good' : 'Fair'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 bg-slate-900/50 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          R² ≥ 0.93: Excellent
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
          R² ≥ 0.90: Good
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          R² &lt; 0.90: Fair
        </span>
      </div>
    </div>
  )
}
