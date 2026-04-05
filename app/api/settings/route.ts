import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { getUserTokens, saveUserTokens, maskToken, UserTokens } from '@/lib/settings'

const MASKED_KEYS: (keyof UserTokens)[] = [
  'vercelToken', 'githubToken', 'supabaseToken', 'stripeSecretKey',
  'resendApiKey', 'clerkSecretKey', 'posthogApiKey', 'sentryAuthToken',
  'pineconeApiKey', 'linkedinToken', 'twitterApiKey', 'twitterApiSecret',
  'twitterAccessToken', 'twitterAccessSecret', 'redditClientSecret',
  'redditPassword',
]

export async function GET() {
  try {
    await requireUser()
    const tokens = await getUserTokens()

    const masked: Record<string, string | null> = {}
    const configured: Record<string, boolean> = {}

    for (const key of Object.keys(tokens) as (keyof UserTokens)[]) {
      if (MASKED_KEYS.includes(key)) {
        masked[key] = maskToken(tokens[key])
        configured[key] = !!tokens[key]
      } else {
        masked[key] = tokens[key]
      }
    }

    return Response.json({ ...masked, configured })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireUser()
    const body = await request.json()

    const patch: Partial<UserTokens> = {}
    for (const key of Object.keys(body) as (keyof UserTokens)[]) {
      if (body[key] !== undefined) {
        (patch as Record<string, string | null>)[key] = body[key] || null
      }
    }

    await saveUserTokens(patch)
    return Response.json({ ok: true })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('PATCH /api/settings error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
