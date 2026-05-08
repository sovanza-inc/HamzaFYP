'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DownloadData {
  predictions: number[]
  city: string
  model: string
  predicted_kwh: number
}

interface DownloadButtonProps {
  data: DownloadData
  type?: 'csv' | 'json'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCsv(data: DownloadData): string {
  const header = 'Hour,Predicted_kWh\n'
  const rows = data.predictions
    .map((kwh, i) => `${i + 1},${kwh.toFixed(4)}`)
    .join('\n')
  return header + rows
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DownloadButton({ data, type = 'csv' }: DownloadButtonProps) {
  const [activeType, setActiveType] = useState<'csv' | 'json'>(type)
  const [downloading, setDownloading] = useState(false)

  const safeName = data.city.replace(/\s+/g, '_').toLowerCase()
  const timestamp = new Date().toISOString().slice(0, 10)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      if (activeType === 'csv') {
        triggerDownload(
          buildCsv(data),
          `eco_forecast_${safeName}_${timestamp}.csv`,
          'text/csv'
        )
      } else {
        triggerDownload(
          JSON.stringify(data, null, 2),
          `eco_forecast_${safeName}_${timestamp}.json`,
          'application/json'
        )
      }
    } finally {
      // Small delay so the user sees feedback
      setTimeout(() => setDownloading(false), 600)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Main download button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-slate-200 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      >
        <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
        {downloading ? 'Saving…' : `Download ${activeType.toUpperCase()}`}
      </button>

      {/* Format toggle */}
      <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs">
        {(['csv', 'json'] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => setActiveType(fmt)}
            className={[
              'px-3 py-2 font-medium transition-colors uppercase',
              activeType === fmt
                ? 'bg-emerald-700/80 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {fmt}
          </button>
        ))}
      </div>
    </div>
  )
}
