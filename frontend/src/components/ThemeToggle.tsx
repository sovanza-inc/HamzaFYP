'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

const STORAGE_KEY = 'eco-forecast-theme'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  // On mount: read persisted preference and apply it
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const prefersDark =
        saved !== null
          ? saved === 'dark'
          : window.matchMedia('(prefers-color-scheme: dark)').matches

      setIsDark(prefersDark)
      applyTheme(prefersDark)
    } catch {
      // SSR / localStorage unavailable — keep default (dark)
    }
  }, [])

  function applyTheme(dark: boolean) {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }
  }

  function toggle() {
    const next = !isDark
    setIsDark(next)
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={[
        'fixed bottom-6 right-6 z-40',
        'w-11 h-11 rounded-full flex items-center justify-center',
        'bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600',
        'text-slate-300 hover:text-white',
        'shadow-lg transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
      ].join(' ')}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-blue-400" />
      )}
    </button>
  )
}
