import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { NewSessionForm } from '@/components/repo-engine/NewSessionForm'
import { DeleteSessionButton } from '@/components/repo-engine/DeleteSessionButton'

export default async function RepoEnginePage() {
  const user = await requireUser()

  const sessions = await prisma.repoSession.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    include: {
      _count: { select: { repoTasks: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const statusColor = (s: string) => {
    if (s === 'READY') return '#6EC8A9'
    if (s === 'ERROR') return '#C86E6E'
    return 'var(--caio-gold)'
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl" style={{ color: 'var(--caio-text)', fontWeight: 700 }}>
            <span style={{ color: 'var(--caio-gold)' }}>⊕</span>{' '}
            Task Engine
          </h1>
          <p className="font-mono text-xs mt-2" style={{ color: 'var(--caio-text-muted)', letterSpacing: '0.03em' }}>
            AI-driven development on any existing repository
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* New session form */}
        <div
          className="rounded-xl p-6"
          style={{ border: '1px solid var(--caio-border)', background: 'rgba(255,255,255,0.02)' }}
        >
          <h2 className="font-mono text-xs font-semibold mb-4" style={{ color: 'var(--caio-gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            New Session
          </h2>
          <NewSessionForm />
        </div>

        {/* Session list */}
        <div>
          <h2 className="font-mono text-xs font-semibold mb-4" style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Active Sessions ({sessions.length})
          </h2>

          {sessions.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 rounded-md gap-3"
              style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
            >
              <p className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>
                No sessions yet. Point the engine at a local git repo to get started.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/repo-engine/${session.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="rounded-md px-4 py-3 transition-colors hover:opacity-90"
                    style={{
                      border: '1px solid var(--caio-border)',
                      background: 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-semibold" style={{ color: 'var(--caio-text)' }}>
                        {session.repoName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[9px] px-1.5 py-px rounded"
                          style={{
                            color: statusColor(session.contextStatus),
                            background: `${statusColor(session.contextStatus)}15`,
                            border: `1px solid ${statusColor(session.contextStatus)}30`,
                          }}
                        >
                          {session.contextStatus}
                        </span>
                        <DeleteSessionButton sessionId={session.id} sessionName={session.repoName} />
                      </div>
                    </div>
                    <p className="font-mono text-[10px] truncate mb-2" style={{ color: 'var(--caio-text-dim)' }}>
                      {session.repoPath}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-muted)' }}>
                        Cycle {session.currentCycle}
                      </span>
                      <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-dim)' }}>
                        {session._count.repoTasks} task{session._count.repoTasks !== 1 ? 's' : ''}
                      </span>
                      <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-dim)' }}>
                        {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
