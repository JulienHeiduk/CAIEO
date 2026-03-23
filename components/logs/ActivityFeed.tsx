import { ActivityLog } from '@/lib/generated/prisma'
import { formatDistanceToNow } from 'date-fns'

const eventColor: Record<string, string> = {
  AGENT_COMPLETED:  '#6EC8A9',
  AGENT_FAILED:     '#C86E6E',
  TASKS_GENERATED:  '#A96EC8',
  COMPANY_CREATED:  '#6E9EC8',
}

const eventSymbol: Record<string, string> = {
  AGENT_COMPLETED:  '✓',
  AGENT_FAILED:     '✗',
  TASKS_GENERATED:  '⬡',
  COMPANY_CREATED:  '◈',
}

const agentLabel: Record<string, string> = {
  LANDING_PAGE:     'engineering',
  LINKEDIN_POST:    'outreach',
  TWITTER_POST:     'outreach',
  REDDIT_POST:      'outreach',
  HACKERNEWS_POST:  'outreach',
  KAGGLE_POST:      'ops & data',
  GROWTH_MARKETING: 'marketing',
  API_SCAFFOLD:     'engineering',
  COMPANY_INIT:     'strategy',
}

interface ActivityFeedProps {
  logs: ActivityLog[]
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  if (logs.length === 0) {
    return (
      <div
        className="text-center py-16 font-mono text-xs"
        style={{ color: 'var(--caio-text-dim)' }}
      >
        No activity yet. Create and execute tasks to see history here.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {logs.map((log) => {
        const color  = eventColor[log.eventType]  ?? '#8899BB'
        const symbol = eventSymbol[log.eventType] ?? '›'
        const dept   = log.agentType ? (agentLabel[log.agentType] ?? log.agentType.toLowerCase().replace(/_/g, ' ')) : null

        return (
          <div
            key={log.id}
            className="rounded-md p-4"
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: `3px solid ${color}`,
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div className="flex items-start gap-3">
              <span className="font-mono text-sm flex-shrink-0 mt-px" style={{ color }}>
                {symbol}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  {dept && (
                    <span
                      className="font-mono text-[9px]"
                      style={{ color, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                    >
                      {dept}
                    </span>
                  )}
                  <span
                    className="font-mono text-[9px]"
                    style={{ color: 'var(--caio-text-dim)' }}
                  >
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--caio-text)' }}>
                  {log.summary}
                </p>
                {log.detail && typeof log.detail === 'object' && (
                  <details className="mt-2">
                    <summary
                      className="font-mono text-[10px] cursor-pointer"
                      style={{ color: 'var(--caio-text-dim)' }}
                    >
                      details ›
                    </summary>
                    <pre
                      className="font-mono text-[10px] mt-2 overflow-auto max-h-28 rounded p-2"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: 'var(--caio-text-muted)',
                      }}
                    >
                      {JSON.stringify(log.detail, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
