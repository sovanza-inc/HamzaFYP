'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  Lightbulb,
  MessageSquare,
  Play,
  Zap,
  Menu,
  X,
  BarChart2,
  History,
  Brain,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/explainability', label: 'Explainability', icon: Lightbulb },
  { href: '/compare', label: 'Compare', icon: BarChart2 },
  { href: '/history', label: 'History', icon: History },
  { href: '/models', label: 'Models', icon: Brain },
  { href: '/qa-agent', label: 'Q&A Agent', icon: MessageSquare },
  { href: '/demo', label: 'Demo', icon: Play },
]

function NavContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-base font-bold text-emerald-400 leading-none">Eco Forecast</span>
            <p className="text-xs text-slate-500 mt-0.5">Smart Energy Forecasting</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white md:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              {label}
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3 mb-3">
          <p className="text-xs text-slate-400 font-medium mb-1.5">Supported Cities</p>
          <div className="flex flex-wrap gap-1">
            {['Lahore', 'Karachi', 'ISB', 'Multan', 'Pesh', 'Skardu'].map((city) => (
              <span key={city} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                {city}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">FYP-BSCS-F25-06</span>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
            v1.0.0
          </span>
        </div>
      </div>
    </>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b border-slate-800 flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-400 hover:text-white"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-emerald-400 text-sm">Eco Forecast</span>
        </div>
      </header>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <NavContent pathname={pathname} onClose={() => setMobileOpen(false)} />
      </aside>

      {/* ── Desktop sidebar (always visible) ── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 flex-col z-50">
        <NavContent pathname={pathname} />
      </aside>
    </>
  )
}
