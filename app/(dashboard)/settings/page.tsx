import { SettingsForm } from '@/components/settings/SettingsForm'
import { getUserTokens, maskToken } from '@/lib/settings'

export default async function SettingsPage() {
  const tokens = await getUserTokens()

  const initial = {
    vercelToken:  maskToken(tokens.vercelToken),
    vercelTeamId: tokens.vercelTeamId ?? '',
    githubToken:  maskToken(tokens.githubToken),
    configured: {
      vercel: !!tokens.vercelToken,
      github: !!tokens.githubToken,
    },
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1
          className="font-heading text-2xl mb-1"
          style={{ color: 'var(--caio-text)' }}
        >
          Integrations
        </h1>
        <p className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>
          API tokens used by AI agents to deploy and publish on your behalf.
          Stored encrypted in the local database.
        </p>
      </div>
      <SettingsForm initial={initial} />
    </div>
  )
}
