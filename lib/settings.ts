import 'server-only'
import { prisma } from './prisma'
import { requireUser } from './auth'
import { encrypt, decrypt } from './encryption'

export interface UserTokens {
  vercelToken: string | null
  vercelTeamId: string | null
  githubToken: string | null
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

/** Load the current user's tokens — DB takes priority over env vars */
export async function getUserTokens(): Promise<UserTokens> {
  const user = await requireUser()
  const s = await prisma.userSettings.findUnique({ where: { userId: user.id } })

  return {
    vercelToken:  (s?.vercelToken  ? tryDecrypt(s.vercelToken)  : null) ?? process.env.VERCEL_TOKEN  ?? null,
    vercelTeamId: s?.vercelTeamId ?? process.env.VERCEL_TEAM_ID ?? null,
    githubToken:  (s?.githubToken  ? tryDecrypt(s.githubToken)  : null) ?? process.env.GITHUB_TOKEN  ?? null,
  }
}

/** Save tokens — only updates fields that are provided (non-empty string) */
export async function saveUserTokens(patch: Partial<UserTokens>): Promise<void> {
  const user = await requireUser()

  const data: Record<string, string | null> = {}

  if (patch.vercelToken !== undefined) {
    data.vercelToken = patch.vercelToken ? encrypt(patch.vercelToken) : null
  }
  if (patch.vercelTeamId !== undefined) {
    data.vercelTeamId = patch.vercelTeamId || null
  }
  if (patch.githubToken !== undefined) {
    data.githubToken = patch.githubToken ? encrypt(patch.githubToken) : null
  }

  await prisma.userSettings.upsert({
    where:  { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  })
}
