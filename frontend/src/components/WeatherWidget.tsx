'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWeather } from '@/src/lib/api'
import { Skeleton } from './Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeatherData {
  temperature: number
  condition: string
  humidity: number
  wind_speed: number
  uv_index: number
  solar_radiation: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weatherIcon(condition: string): string {
  const c = condition.toLowerCase()
  if (c.includes('rain') || c.includes('drizzle') || c.includes('storm')) return '🌧️'
  if (c.includes('cloud') || c.includes('overcast')) return '☁️'
  if (c.includes('snow') || c.includes('cold') || c.includes('freez')) return '❄️'
  if (c.includes('hot') || c.includes('heat') || c.includes('scorch')) return '🌡️'
  if (c.includes('clear') || c.includes('partly')) return '🌤️'
  return '☀️'
}

const AUTO_REFRESH_MS = 5 * 60 * 1000 // 5 minutes

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeatherWidget({ city }: { city: string }) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const lastKnownRef = useRef<WeatherData | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchWeather = useCallback(async () => {
    try {
      const res = await getCurrentWeather(city)
      const raw = res.data

      const parsed: WeatherData = {
        temperature:     raw?.temperature    ?? raw?.temp        ?? 32,
        condition:       raw?.condition      ?? raw?.description ?? 'Clear',
        humidity:        raw?.humidity       ?? 65,
        wind_speed:      raw?.wind_speed     ?? raw?.wind        ?? 12,
        uv_index:        raw?.uv_index       ?? raw?.uv          ?? 6,
        solar_radiation: raw?.solar_radiation ?? raw?.solar       ?? 450,
      }

      setData(parsed)
      lastKnownRef.current = parsed
      setOffline(false)
    } catch {
      // Show last known values if available
      if (lastKnownRef.current) {
        setData(lastKnownRef.current)
        setOffline(true)
      } else {
        // Fallback mock so the widget always renders something
        const mock: WeatherData = {
          temperature: 34, condition: 'Clear', humidity: 55,
          wind_speed: 10, uv_index: 7, solar_radiation: 520,
        }
        setData(mock)
        lastKnownRef.current = mock
        setOffline(true)
      }
    } finally {
      setLoading(false)
    }
  }, [city])

  // Fetch on mount and when city changes
  useEffect(() => {
    setLoading(true)
    setData(null)
    setOffline(false)
    fetchWeather()
  }, [fetchWeather])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    timerRef.current = setInterval(fetchWeather, AUTO_REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchWeather])

  // ── Loading state ──
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-10 w-20 mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 text-sm font-medium">{city} — Current Weather</span>
        </div>
        {offline ? (
          <span className="text-xs bg-slate-600/60 border border-slate-500/40 text-slate-400 px-2 py-0.5 rounded-full">
            Offline
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs bg-emerald-900/40 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live
          </span>
        )}
      </div>

      {/* Main temperature display */}
      <div className="flex items-end gap-3 mb-4">
        <span className="text-4xl" aria-hidden="true">
          {weatherIcon(data.condition)}
        </span>
        <div>
          <p className="text-4xl font-bold text-white leading-none">
            {data.temperature}
            <span className="text-2xl text-slate-400">°C</span>
          </p>
          <p className="text-slate-400 text-sm mt-0.5">{data.condition}</p>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatChip label="Humidity"        value={`${data.humidity}%`}               icon="💧" />
        <StatChip label="Wind"            value={`${data.wind_speed} km/h`}         icon="💨" />
        <StatChip label="UV Index"        value={`${data.uv_index}`}                icon="🔆" />
        <StatChip label="Solar Radiation" value={`${data.solar_radiation} W/m²`}    icon="☀️" />
      </div>
    </div>
  )
}

function StatChip({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: string
}) {
  return (
    <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
      <span className="text-base leading-none" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-slate-400 text-xs leading-none mb-0.5">{label}</p>
        <p className="text-white text-sm font-medium leading-none">{value}</p>
      </div>
    </div>
  )
}
