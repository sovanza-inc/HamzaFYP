'use client'

import { useCallback, useEffect, useState } from 'react'
import { Lightbulb, Thermometer, Zap, Wind, RefreshCw, Droplets } from 'lucide-react'
import { getTips, getTipsFromShap } from '@/src/lib/api'
import { CardSkeleton } from './Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Priority = 'High' | 'Medium' | 'Low'

interface TipItem {
  id: string
  text: string
  priority: Priority
  feature: string
  icon: React.ReactNode
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const priorityBorder: Record<Priority, string> = {
  High:   'border-red-500/40',
  Medium: 'border-amber-500/40',
  Low:    'border-slate-600',
}

const priorityBadge: Record<Priority, string> = {
  High:   'bg-red-500/20 text-red-400 border border-red-500/30',
  Medium: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Low:    'bg-slate-700 text-slate-400 border border-slate-600',
}

const featureIcon = (feature: string): React.ReactNode => {
  const f = feature.toLowerCase()
  if (f.includes('temp'))   return <Thermometer className="w-4 h-4" />
  if (f.includes('humid'))  return <Droplets className="w-4 h-4" />
  if (f.includes('wind'))   return <Wind className="w-4 h-4" />
  if (f.includes('solar') || f.includes('rad')) return <Zap className="w-4 h-4" />
  return <Lightbulb className="w-4 h-4" />
}

/** Parse raw API tip into a TipItem */
function parseTip(raw: Record<string, unknown>, index: number): TipItem {
  const priority = (['High', 'Medium', 'Low'].includes(raw.priority as string)
    ? raw.priority
    : index === 0 ? 'High' : index === 1 ? 'Medium' : 'Low') as Priority

  const feature = (raw.feature ?? raw.source_feature ?? 'energy') as string

  return {
    id:       `${index}-${Date.now()}`,
    text:     (raw.tip ?? raw.text ?? raw.message ?? 'Optimise your energy usage.') as string,
    priority,
    feature,
    icon:     featureIcon(feature),
  }
}

/** Fallback static tips when API is unavailable */
function fallbackTips(city: string): TipItem[] {
  return [
    {
      id: 'fb-0',
      text: `Set your AC thermostat to 26°C or higher in ${city} to cut cooling costs by up to 20%.`,
      priority: 'High',
      feature: 'temperature',
      icon: <Thermometer className="w-4 h-4" />,
    },
    {
      id: 'fb-1',
      text: 'Switch off unnecessary lights during peak solar hours (10 AM – 4 PM) to reduce lighting load.',
      priority: 'Medium',
      feature: 'solar_radiation',
      icon: <Lightbulb className="w-4 h-4" />,
    },
    {
      id: 'fb-2',
      text: 'Run heavy appliances (washing machine, dishwasher) during off-peak hours to flatten the demand curve.',
      priority: 'Low',
      feature: 'hour_of_day',
      icon: <Zap className="w-4 h-4" />,
    },
  ]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TipCard({ tip, index }: { tip: TipItem; index: number }) {
  return (
    <div
      className={[
        'bg-slate-800/80 rounded-xl border p-4 flex gap-3',
        'transition-all duration-500',
        priorityBorder[tip.priority],
      ].join(' ')}
      style={{
        opacity: 1,
        transform: 'translateY(0)',
        animation: `fadeSlideIn 0.4s ease ${index * 0.1}s both`,
      }}
    >
      {/* Icon circle */}
      <div className="shrink-0 w-9 h-9 rounded-full bg-slate-700/70 flex items-center justify-center text-emerald-400 mt-0.5">
        {tip.icon}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityBadge[tip.priority]}`}>
            {tip.priority}
          </span>
          <span className="flex items-center gap-1 text-xs bg-slate-700/60 border border-slate-600/60 text-slate-400 px-2 py-0.5 rounded-full">
            {featureIcon(tip.feature)}
            <span>{tip.feature.replace(/_/g, ' ')}</span>
          </span>
        </div>

        {/* Tip text */}
        <p className="text-slate-200 text-sm leading-snug">{tip.text}</p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EnergyTipsProps {
  city: string
  featureImportances?: Array<{ feature: string; importance: number }>
}

export default function EnergyTips({ city, featureImportances }: EnergyTipsProps) {
  const [tips, setTips] = useState<TipItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchTips = useCallback(async () => {
    setLoading(true)
    try {
      let raw: Record<string, unknown>[]

      if (featureImportances && featureImportances.length > 0) {
        const res = await getTipsFromShap(featureImportances, city)
        raw = res.data?.tips ?? res.data ?? []
      } else {
        const res = await getTips(city)
        raw = res.data?.tips ?? res.data ?? []
      }

      const parsed = Array.isArray(raw) && raw.length > 0
        ? raw.slice(0, 3).map(parseTip)
        : fallbackTips(city)

      setTips(parsed)
    } catch {
      setTips(fallbackTips(city))
    } finally {
      setLoading(false)
    }
  }, [city, featureImportances, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchTips()
  }, [fetchTips])

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">Energy Saving Tips</h3>
          <p className="text-slate-400 text-sm mt-0.5">
            Personalised recommendations for {city}
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh tips
        </button>
      </div>

      {/* Tips grid */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
          : tips.map((tip, i) => <TipCard key={tip.id} tip={tip} index={i} />)}
      </div>

      {/* CSS animation keyframes injected inline */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  )
}
