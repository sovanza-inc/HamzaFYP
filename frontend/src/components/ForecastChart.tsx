'use client'

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface ForecastChartProps {
  predictions: number[]
  city: string
  model: string
  confidenceLower?: number[]
  confidenceUpper?: number[]
}

interface ChartDataPoint {
  hour: string
  predicted: number
  lowerCI?: number
  upperCI?: number
  ciRange?: [number, number]
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number | number[]; color: string }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    const predicted = payload.find((p) => p.name === 'predicted')
    const ci = payload.find((p) => p.name === 'ciRange')

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-slate-300 font-medium mb-2">Hour {label}</p>
        {predicted && (
          <p className="text-emerald-400 text-sm">
            Predicted: <span className="font-bold">{Number(predicted.value).toFixed(3)} kWh</span>
          </p>
        )}
        {ci && Array.isArray(ci.value) && ci.value.length === 2 && (
          <p className="text-blue-400 text-sm">
            CI: [{Number(ci.value[0]).toFixed(3)}, {Number(ci.value[1]).toFixed(3)}]
          </p>
        )}
      </div>
    )
  }
  return null
}

export default function ForecastChart({
  predictions,
  city,
  model,
  confidenceLower,
  confidenceUpper,
}: ForecastChartProps) {
  const data: ChartDataPoint[] = predictions.map((val, idx) => {
    const point: ChartDataPoint = {
      hour: String(idx + 1),
      predicted: parseFloat(val.toFixed(4)),
    }

    if (confidenceLower && confidenceUpper) {
      point.lowerCI = parseFloat(confidenceLower[idx].toFixed(4))
      point.upperCI = parseFloat(confidenceUpper[idx].toFixed(4))
      point.ciRange = [
        parseFloat(confidenceLower[idx].toFixed(4)),
        parseFloat(confidenceUpper[idx].toFixed(4)),
      ]
    }

    return point
  })

  const hasCi = !!(confidenceLower && confidenceUpper)

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">24-Hour Energy Forecast</h3>
          <p className="text-slate-400 text-sm">
            {city} — {model} model
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />
          <span className="text-xs text-slate-400">Predicted kWh</span>
          {hasCi && (
            <>
              <span className="w-3 h-3 bg-emerald-400/20 inline-block rounded ml-2" />
              <span className="text-xs text-slate-400">CI Band</span>
            </>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="ciGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            label={{ value: 'Hour of Day', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
            label={{
              value: 'kWh',
              angle: -90,
              position: 'insideLeft',
              offset: 15,
              fill: '#64748b',
              fontSize: 12,
            }}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '12px', fontSize: '12px', color: '#94a3b8' }}
            formatter={(value) =>
              value === 'predicted'
                ? 'Predicted kWh'
                : value === 'ciRange'
                ? 'CI Range'
                : value
            }
          />

          {hasCi && (
            <Area
              type="monotone"
              dataKey="ciRange"
              fill="url(#ciGradient)"
              stroke="none"
              name="ciRange"
              isAnimationActive={false}
            />
          )}

          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
            name="predicted"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
