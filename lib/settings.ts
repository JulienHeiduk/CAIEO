import 'server-only'
import { prisma } from './prisma'
import { requireUser } from './auth'
import { encrypt, decrypt } from './encryption'

export interface UserTokens {
  // Deployment & Code
  vercelToken: string | null
  vercelTeamId: string | null
  githubToken: string | null
  // Backend & Database
  supabaseToken: string | null
  supabaseOrgId: string | null
  // Payments
  stripeSecretKey: string | null
  // Email
  resendApiKey: string | null
  // Auth
  clerkSecretKey: string | null
  // Analytics & Monitoring
  posthogApiKey: string | null
  posthogHost: string | null
  sentryAuthToken: string | null
  sentryOrg: string | null
  // Vector DB
  pineconeApiKey: string | null
  // Social Media
  linkedinToken: string | null
  twitterApiKey: string | null
  twitterApiSecret: string | null
  twitterAccessToken: string | null
  twitterAccessSecret: string | null
  redditClientId: string | null
  redditClientSecret: string | null
  redditUsername: string | null
  redditPassword: string | null
}

/** Masked representation for display (last 4 chars visible) */
export function maskToken(token: string | null): string | null {
  if (!token) return null
  if (token.length <= 8) return '••••••••'
  return `${'•'.repeat(token.length - 4)}${token.slice(-4)}`
}

function tryDecrypt(val: string): string | null {
  try { return decrypt(val) } catch { return null }
}

// Fields that are encrypted (secrets) vs plain text (IDs, hosts, usernames)
const ENCRYPTED_FIELDS = [
  'vercelToken', 'githubToken', 'supabaseToken', 'stripeSecretKey',
  'resendApiKey', 'clerkSecretKey', 'posthogApiKey', 'sentryAuthToken',
  'pineconeApiKey', 'linkedinToken', 'twitterApiKey', 'twitterApiSecret',
  'twitterAccessToken', 'twitterAccessSecret', 'redditClientSecret',
  'redditPassword',
] as const

const PLAIN_FIELDS = [
  'vercelTeamId', 'supabaseOrgId', 'posthogHost', 'sentryOrg',
  'redditClientId', 'redditUsername',
] as const

/** Load the current user's tokens — DB takes priority over env vars */
export async function getUserTokens(): Promise<UserTokens> {
  const user = await requireUser()
  const s = await prisma.userSettings.findUnique({ where: { userId: user.id } })

  const decryptField = (field: string): string | null => {
    const val = s?.[field as keyof typeof s] as string | null
    return val ? tryDecrypt(val) : null
  }

  const plainField = (field: string): string | null => {
    return (s?.[field as keyof typeof s] as string | null) ?? null
  }

  return {
    vercelToken:         decryptField('vercelToken')  ?? process.env.VERCEL_TOKEN  ?? null,
    vercelTeamId:        plainField('vercelTeamId')    ?? process.env.VERCEL_TEAM_ID ?? null,
    githubToken:         decryptField('githubToken')   ?? process.env.GITHUB_TOKEN  ?? null,
    supabaseToken:       decryptField('supabaseToken') ?? null,
    supabaseOrgId:       plainField('supabaseOrgId')   ?? null,
    stripeSecretKey:     decryptField('stripeSecretKey') ?? null,
    resendApiKey:        decryptField('resendApiKey')    ?? null,
    clerkSecretKey:      decryptField('clerkSecretKey')  ?? null,
    posthogApiKey:       decryptField('posthogApiKey')   ?? null,
    posthogHost:         plainField('posthogHost')       ?? null,
    sentryAuthToken:     decryptField('sentryAuthToken') ?? null,
    sentryOrg:           plainField('sentryOrg')         ?? null,
    pineconeApiKey:      decryptField('pineconeApiKey')  ?? null,
    linkedinToken:       decryptField('linkedinToken')   ?? null,
    twitterApiKey:       decryptField('twitterApiKey')   ?? null,
    twitterApiSecret:    decryptField('twitterApiSecret') ?? null,
    twitterAccessToken:  decryptField('twitterAccessToken') ?? null,
    twitterAccessSecret: decryptField('twitterAccessSecret') ?? null,
    redditClientId:      plainField('redditClientId')    ?? null,
    redditClientSecret:  decryptField('redditClientSecret') ?? null,
    redditUsername:       plainField('redditUsername')    ?? null,
    redditPassword:      decryptField('redditPassword')  ?? null,
  }
}

/** Save tokens — only updates fields that are provided (non-empty string) */
export async function saveUserTokens(patch: Partial<UserTokens>): Promise<void> {
  const user = await requireUser()

  const data: Record<string, string | null> = {}

  for (const field of ENCRYPTED_FIELDS) {
    if (patch[field] !== undefined) {
      data[field] = patch[field] ? encrypt(patch[field]!) : null
    }
  }

  for (const field of PLAIN_FIELDS) {
    if (patch[field] !== undefined) {
      data[field] = patch[field] || null
    }
  }

  await prisma.userSettings.upsert({
    where:  { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  })
}

/** Returns a summary of which services are configured (for orchestrator context) */
export function getConfiguredServices(tokens: UserTokens): string[] {
  const services: string[] = []
  if (tokens.vercelToken)      services.push('Vercel (deployment)')
  if (tokens.githubToken)      services.push('GitHub (code repos)')
  if (tokens.supabaseToken)    services.push('Supabase (database/backend)')
  if (tokens.stripeSecretKey)  services.push('Stripe (payments)')
  if (tokens.resendApiKey)     services.push('Resend (emails)')
  if (tokens.clerkSecretKey)   services.push('Clerk (auth)')
  if (tokens.posthogApiKey)    services.push('PostHog (analytics)')
  if (tokens.sentryAuthToken)  services.push('Sentry (error tracking)')
  if (tokens.pineconeApiKey)   services.push('Pinecone (vector DB)')
  if (tokens.linkedinToken)    services.push('LinkedIn (social posting)')
  if (tokens.twitterApiKey)    services.push('Twitter/X (social posting)')
  if (tokens.redditClientId)   services.push('Reddit (social posting)')
  return services
}
