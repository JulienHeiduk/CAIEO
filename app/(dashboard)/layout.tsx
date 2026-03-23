export const dynamic = 'force-dynamic'

import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    await requireUser()
  } catch {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--caio-bg)', color: 'var(--caio-text)' }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col flex-shrink-0"
        style={{ background: 'var(--caio-header)', borderRight: '1px solid var(--caio-border)' }}
      >
        {/* Brand */}
        <div className="p-6" style={{ borderBottom: '1px solid var(--caio-border)' }}>
          <Link href="/dashboard" className="block">
            <span className="font-heading text-2xl" style={{ color: 'var(--caio-gold)', fontWeight: 700 }}>
              CAIO
            </span>
          </Link>
          <p className="font-mono text-[10px] mt-1" style={{ color: 'var(--caio-text-muted)', letterSpacing: '0.05em' }}>
            Chief AI Intelligence Officer
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 flex flex-col gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors font-mono text-xs"
            style={{ color: 'var(--caio-text-secondary)' }}
          >
            <span style={{ color: 'var(--caio-gold)' }}>◈</span>
            Portfolio
          </Link>
          <Link
            href="/companies/new"
            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors font-mono text-xs"
            style={{ color: 'var(--caio-text-secondary)' }}
          >
            <span style={{ color: 'var(--caio-gold)' }}>+</span>
            New Company
          </Link>
        </nav>

        {/* User */}
        <div
          className="p-4 flex items-center gap-3"
          style={{ borderTop: '1px solid var(--caio-border)' }}
        >
          <UserButton />
          <span className="font-mono text-[10px]" style={{ color: 'var(--caio-text-muted)' }}>
            Account
          </span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
