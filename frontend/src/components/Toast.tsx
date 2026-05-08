'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  message: string
  type: ToastType
  visible: boolean
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Styling helpers ──────────────────────────────────────────────────────────

const typeStyles: Record<ToastType, string> = {
  success: 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100',
  error:   'bg-red-900/90 border-red-500/40 text-red-100',
  info:    'bg-blue-900/90 border-blue-500/40 text-blue-100',
  warning: 'bg-amber-900/90 border-amber-500/40 text-amber-100',
}

const iconStyles: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error:   'text-red-400',
  info:    'text-blue-400',
  warning: 'text-amber-400',
}

const ToastIcon = ({ type }: { type: ToastType }) => {
  const cls = `w-5 h-5 shrink-0 ${iconStyles[type]}`
  switch (type) {
    case 'success': return <CheckCircle className={cls} />
    case 'error':   return <AlertCircle className={cls} />
    case 'warning': return <AlertTriangle className={cls} />
    case 'info':
    default:        return <Info className={cls} />
  }
}

// ─── Single Toast item ────────────────────────────────────────────────────────

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl w-80 max-w-full text-sm',
        'transition-all duration-300',
        item.visible
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-full pointer-events-none',
        typeStyles[item.type],
      ].join(' ')}
    >
      <ToastIcon type={item.type} />
      <span className="flex-1 leading-snug">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    // Trigger slide-out first
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    )
    // Remove from DOM after transition
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 320)
    timersRef.current.set(`remove-${id}`, removeTimer)
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      setToasts((prev) => {
        // Cap at 5 toasts — remove oldest if needed
        const capped = prev.length >= 5 ? prev.slice(prev.length - 4) : prev
        return [...capped, { id, message, type, visible: false }]
      })

      // Trigger slide-in on next tick
      const showTimer = setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, visible: true } : t))
        )
      }, 30)
      timersRef.current.set(`show-${id}`, showTimer)

      // Auto-dismiss after 4 s
      const autoTimer = setTimeout(() => dismiss(id), 4000)
      timersRef.current.set(`auto-${id}`, autoTimer)
    },
    [dismiss]
  )

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Portal-like fixed container — top-right corner */}
      <div
        aria-label="Notifications"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}
