'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/src/components/Sidebar'
import ThemeToggle from '@/src/components/ThemeToggle'

const AUTH_KEY = 'eco_forecast_auth'

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(AUTH_KEY) === '1'
}

export function login(username: string, password: string): boolean {
  if (username.trim().toLowerCase() === 'admin' && password === 'admin') {
    window.localStorage.setItem(AUTH_KEY, '1')
    return true
  }
  return false
}

export function logout() {
  window.localStorage.removeItem(AUTH_KEY)
}

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const ok = isAuthenticated()
    setAuthed(ok)
    setReady(true)
    if (!ok && pathname !== '/login') {
      router.replace('/login')
    } else if (ok && pathname === '/login') {
      router.replace('/')
    }
  }, [pathname, router])

  // Login page: render children full-screen, no sidebar
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Hide app until we know auth state to avoid a flash of protected content
  if (!ready || !authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <>
      <Sidebar />
      <main className="md:ml-64 pt-14 md:pt-0 min-h-screen overflow-x-hidden">
        <div className="p-4 sm:p-6 lg:p-8 min-h-screen">{children}</div>
      </main>
      <ThemeToggle />
    </>
  )
}
