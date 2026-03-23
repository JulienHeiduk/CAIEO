import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  const company = await prisma.company.findFirst({
    where: { id, userId: user.id },
    include: {
      _count: {
        select: { tasks: true, activityLogs: true },
      },
    },
  })

  if (!company) notFound()

  const statusColors: Record<string, string> = {
    INITIALIZING: '#C8A96E',
    ACTIVE:       '#6EC8A9',
    PAUSED:       '#8899BB',
    ARCHIVED:     '#C86E6E',
  }
  const color = statusColors[company.status] ?? '#8899BB'

  const linkBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--caio-text-secondary)',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 11,
    padding: '6px 12px',
    borderRadius: 5,
    textDecoration: 'none',
    transition: 'opacity 0.15s',
  } as const

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="inline-block rounded-full flex-shrink-0"
                style={{ width: 8, height: 8, background: color }}
              />
              <h1 className="font-heading text-3xl" style={{ color: 'var(--caio-text)', fontWeight: 700 }}>
                {company.name}
              </h1>
              <span
                className="font-mono text-[9px] px-2 py-0.5 rounded"
                style={{
                  color,
                  background: `${color}18`,
                  border: `1px solid ${color}33`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {company.status.toLowerCase()}
              </span>
            </div>
            <p className="font-mono text-xs" style={{ color: 'var(--caio-text-muted)', lineHeight: 1.6 }}>
              {company.description}
            </p>
            {company.landingPageUrl && (
              <a
                href={company.landingPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs mt-2 inline-flex items-center gap-1 transition-opacity hover:opacity-75"
                style={{ color: 'var(--caio-blue)', textDecoration: 'none' }}
              >
                ◎ {company.landingPageUrl}
              </a>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href={`/companies/${id}/tasks`} style={linkBtn}>
              ⚑ Tasks ({company._count.tasks})
            </Link>
            <Link href={`/companies/${id}/logs`} style={linkBtn}>
              ◎ Logs
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-8 flex-wrap">
        {[
          { label: 'Tasks', value: company._count.tasks },
          { label: 'Events', value: company._count.activityLogs },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-md px-4 py-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--caio-border)', minWidth: 80 }}
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

      {/* Strategy */}
      {company.strategy && (
        <div
          className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="font-mono text-[9px] mb-4" style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Growth Strategy
          </div>
          <div className="space-y-3">
            {company.strategy.split('\n').map((paragraph: string, i: number) => (
              <p key={i} className="text-sm" style={{ color: 'var(--caio-text-secondary)', lineHeight: 1.7 }}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Initializing state */}
      {company.status === 'INITIALIZING' && (
        <div
          className="rounded-xl p-5 mt-6 flex items-center gap-3"
          style={{ background: 'rgba(200,169,110,0.06)', border: '1px solid rgba(200,169,110,0.2)', borderLeft: '3px solid var(--caio-gold)' }}
        >
          <div
            className="rounded-full flex-shrink-0 animate-ping-caio"
            style={{ width: 8, height: 8, background: 'var(--caio-gold)', opacity: 0.8 }}
          />
          <p className="font-mono text-xs" style={{ color: 'var(--caio-gold)' }}>
            CAIO is generating your company strategy and initial tasks...
          </p>
        </div>
      )}
    </div>
  )
}
