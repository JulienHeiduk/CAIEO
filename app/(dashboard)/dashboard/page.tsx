import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { CompanyCard } from '@/components/companies/CompanyCard'

export default async function DashboardPage() {
  const user = await requireUser()

  const companies = await prisma.company.findMany({
    where: { userId: user.id, status: { not: 'ARCHIVED' } },
    include: {
      _count: {
        select: {
          tasks: { where: { status: 'PENDING_REVIEW' } },
          activityLogs: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalPending = companies.reduce((sum, c) => sum + c._count.tasks, 0)

  const goldBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--caio-gold)',
    color: '#0F0F1A',
    border: 'none',
    borderRadius: 5,
    padding: '7px 16px',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textDecoration: 'none',
    cursor: 'pointer',
  } as const

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl" style={{ color: 'var(--caio-text)', fontWeight: 700 }}>
            Your{' '}
            <span style={{ color: 'var(--caio-gold)' }}>AI-run</span>{' '}
            portfolio
          </h1>
          <p className="font-mono text-xs mt-2" style={{ color: 'var(--caio-text-muted)', letterSpacing: '0.03em' }}>
            {companies.length === 0
              ? 'Submit an idea — CAIO runs your company autonomously.'
              : `${companies.length} compan${companies.length === 1 ? 'y' : 'ies'} under AI management`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalPending > 0 && (
            <span
              className="font-mono text-[10px] px-3 py-1 rounded"
              style={{
                color: 'var(--caio-gold)',
                background: 'rgba(200,169,110,0.08)',
                border: '1px solid rgba(200,169,110,0.25)',
              }}
            >
              ⚑ {totalPending} pending
            </span>
          )}
          <Link
            href="/github/bootstrap"
            style={{
              ...goldBtn,
              background: 'rgba(200,169,110,0.12)',
              color: 'var(--caio-gold)',
              border: '1px solid rgba(200,169,110,0.3)',
            }}
          >
            ⌥ Bootstrap Repo
          </Link>
          <Link
            href="/repo-engine"
            style={{
              ...goldBtn,
              background: 'rgba(200,169,110,0.12)',
              color: 'var(--caio-gold)',
              border: '1px solid rgba(200,169,110,0.3)',
            }}
          >
            ⊕ Task Engine
          </Link>
          <Link href="/companies/new" style={goldBtn}>
            + New Company
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {companies.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center min-h-[360px] rounded-xl gap-5"
          style={{ border: '1px dashed rgba(255,255,255,0.1)' }}
        >
          <div className="font-heading text-5xl text-center" style={{ color: 'var(--caio-text)', lineHeight: 1.2 }}>
            Your<br />
            <span style={{ color: 'var(--caio-gold)' }}>AI-run</span><br />
            portfolio
          </div>
          <p
            className="font-mono text-xs text-center max-w-xs"
            style={{ color: 'var(--caio-text-dim)', lineHeight: 1.7 }}
          >
            Each company gets its own CAIO instance — strategy, engineering,
            marketing, outreach, ops. You validate once a day.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link href="/companies/new" style={{ ...goldBtn, padding: '12px 24px', fontSize: 12 }}>
              + LAUNCH FIRST COMPANY
            </Link>
            <Link
              href="/github/bootstrap"
              style={{
                ...goldBtn,
                padding: '12px 24px',
                fontSize: 12,
                background: 'rgba(200,169,110,0.12)',
                color: 'var(--caio-gold)',
                border: '1px solid rgba(200,169,110,0.3)',
              }}
            >
              ⌥ BOOTSTRAP REPO
            </Link>
            <Link
              href="/repo-engine"
              style={{
                ...goldBtn,
                padding: '12px 24px',
                fontSize: 12,
                background: 'rgba(200,169,110,0.12)',
                color: 'var(--caio-gold)',
                border: '1px solid rgba(200,169,110,0.3)',
              }}
            >
              ⊕ TASK ENGINE
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="flex gap-3 mb-6 flex-wrap">
            {[
              { label: 'Companies', value: companies.length },
              { label: 'Pending', value: totalPending },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-md px-4 py-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--caio-border)' }}
              >
                <div className="font-mono text-[9px] mb-1" style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {m.label}
                </div>
                <div className="font-mono text-base font-bold" style={{ color: 'var(--caio-text)' }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {companies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
            {/* Add new company */}
            <Link
              href="/companies/new"
              className="rounded-xl flex flex-col items-center justify-center gap-2 min-h-[160px] transition-colors"
              style={{ border: '1px dashed rgba(255,255,255,0.1)', textDecoration: 'none' }}
            >
              <span style={{ fontSize: 24, color: 'var(--caio-text-dim)' }}>+</span>
              <span className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>New Company</span>
            </Link>
            {/* Bootstrap repo */}
            <Link
              href="/github/bootstrap"
              className="rounded-xl flex flex-col items-center justify-center gap-2 min-h-[160px] transition-colors"
              style={{ border: '1px dashed rgba(200,169,110,0.2)', textDecoration: 'none' }}
            >
              <span style={{ fontSize: 22, color: 'var(--caio-gold)', opacity: 0.5 }}>⌥</span>
              <span className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>Bootstrap Repo</span>
            </Link>
            {/* Task Engine */}
            <Link
              href="/repo-engine"
              className="rounded-xl flex flex-col items-center justify-center gap-2 min-h-[160px] transition-colors"
              style={{ border: '1px dashed rgba(200,169,110,0.2)', textDecoration: 'none' }}
            >
              <span style={{ fontSize: 22, color: 'var(--caio-gold)', opacity: 0.5 }}>⊕</span>
              <span className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>Task Engine</span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
