'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  Lightbulb,
  MessageSquare,
  Play,
  Zap,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/explainability', label: 'Explainability', icon: Lightbulb },
  { href: '/qa-agent', label: 'Q&A Agent', icon: MessageSquare },
  { href: '/demo', label: 'Demo', icon: Play },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-lg font-bold text-emerald-400">Eco Forecast</span>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Smart Energy Forecasting</p>
          </div>
        </div>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              {label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Pakistani Cities Badge */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3 mb-3">
          <p className="text-xs text-slate-400 font-medium mb-1">Supported Cities</p>
          <div className="flex flex-wrap gap-1">
            {['Lahore', 'Karachi', 'ISB', 'Multan', 'Pesh', 'Skardu'].map((city) => (
              <span
                key={city}
                className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded"
              >
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
    </aside>
  )
}
