import Link from 'next/link'

interface Company {
  id: string
  name: string
  description: string
  status: string
  createdAt: Date
  _count: {
    tasks: number
    activityLogs: number
  }
}

const statusConfig: Record<string, { label: string; color: string }> = {
  INITIALIZING: { label: 'initializing', color: '#C8A96E' },
  ACTIVE:       { label: 'active',       color: '#6EC8A9' },
  PAUSED:       { label: 'paused',       color: '#8899BB' },
  ARCHIVED:     { label: 'archived',     color: '#C86E6E' },
}

export function CompanyCard({ company }: { company: Company }) {
  const status = statusConfig[company.status] ?? statusConfig.ACTIVE
  const pending = company._count.tasks

  return (
    <Link href={`/companies/${company.id}`} style={{ textDecoration: 'none' }}>
      <div
        className="rounded-lg p-4 transition-all duration-200 cursor-pointer h-full block animate-slide-up"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderTop: `3px solid ${status.color}`,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(255,255,255,0.06)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(255,255,255,0.03)'
        }}
      >
        {/* Name + status dot */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-block rounded-full flex-shrink-0"
            style={{ width: 7, height: 7, background: status.color }}
          />
          <span
            className="font-heading text-base"
            style={{ color: 'var(--caio-text)', fontWeight: 700 }}
          >
            {company.name}
          </span>
        </div>

        {/* Description */}
        <p
          className="font-mono text-[10px] mb-3 line-clamp-2"
          style={{ color: 'var(--caio-text-muted)', lineHeight: 1.6 }}
        >
          {company.description}
        </p>

        {/* Badges */}
        <div className="flex gap-2 flex-wrap mb-4">
          <span
            className="font-mono text-[9px] px-2 py-0.5 rounded"
            style={{
              color: status.color,
              background: `${status.color}18`,
              border: `1px solid ${status.color}33`,
            }}
          >
            {status.label}
          </span>
          {pending > 0 && (
            <span
              className="font-mono text-[9px] px-2 py-0.5 rounded"
              style={{
                color: 'var(--caio-gold)',
                background: 'rgba(200,169,110,0.1)',
                border: '1px solid rgba(200,169,110,0.25)',
              }}
            >
              ⚑ {pending} pending
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          {[
            { l: 'tasks', v: company._count.tasks },
            { l: 'events', v: company._count.activityLogs },
          ].map((m) => (
            <div key={m.l}>
              <div
                className="font-mono text-[9px] mb-0.5"
                style={{ color: 'var(--caio-text-dim)', textTransform: 'uppercase' }}
              >
                {m.l}
              </div>
              <div
                className="font-mono text-sm font-bold"
                style={{ color: 'var(--caio-text-secondary)' }}
              >
                {m.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}
