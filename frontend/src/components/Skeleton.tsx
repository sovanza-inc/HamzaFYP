// Skeleton loading components — no 'use client' needed (pure presentational)

// ─── Base ─────────────────────────────────────────────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-slate-700/50 animate-pulse rounded ${className}`}
      aria-hidden="true"
    />
  )
}

// ─── Compound skeletons ───────────────────────────────────────────────────────

/** Mimics a stat / metric card */
export function CardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-3">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-3 w-36" />
    </div>
  )
}

/** Tall placeholder for a chart area */
export function ChartSkeleton() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      {/* Chart area */}
      <Skeleton className="h-72 w-full rounded-lg" />
      {/* X-axis labels */}
      <div className="flex justify-between mt-2 px-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-6" />
        ))}
      </div>
    </div>
  )
}

/** A single table row with 4 cells */
export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-700/50">
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-3.5 w-24 flex-1" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3.5 w-14" />
    </div>
  )
}

/** Mimics a forecast result card */
export function ForecastCardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      {/* Metric rows */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* Mini bar */}
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}
