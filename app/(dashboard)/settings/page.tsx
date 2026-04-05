import { SettingsForm } from '@/components/settings/SettingsForm'
import { getUserTokens, maskToken, UserTokens } from '@/lib/settings'

const MASKED_KEYS: (keyof UserTokens)[] = [
  'vercelToken', 'githubToken', 'supabaseToken', 'stripeSecretKey',
  'resendApiKey', 'clerkSecretKey', 'posthogApiKey', 'sentryAuthToken',
  'pineconeApiKey', 'linkedinToken', 'twitterApiKey', 'twitterApiSecret',
  'twitterAccessToken', 'twitterAccessSecret', 'redditClientSecret',
  'redditPassword',
]

export default async function SettingsPage() {
  const tokens = await getUserTokens()

  const initial: Record<string, unknown> = { configured: {} }
  const configured: Record<string, boolean> = {}

  for (const key of Object.keys(tokens) as (keyof UserTokens)[]) {
    if (MASKED_KEYS.includes(key)) {
      initial[key] = maskToken(tokens[key])
      configured[key] = !!tokens[key]
    } else {
      initial[key] = tokens[key] ?? ''
    }
  }

  initial.configured = configured

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-heading text-2xl mb-1" style={{ color: 'var(--caio-text)' }}>
          Integrations
        </h1>
        <p className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>
          API tokens used by AI agents to deploy, publish, and operate autonomously.
          Stored encrypted in the local database.
        </p>
      </div>
      <SettingsForm initial={initial as never} />
    </div>
  )
}
