import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserTokens, saveUserTokens, maskToken } from '@/lib/settings'

export async function GET() {
  try {
    await requireUser()
    const tokens = await getUserTokens()
    // Never send plain tokens to the client — send masked versions only
    return Response.json({
      vercelToken:  maskToken(tokens.vercelToken),
      vercelTeamId: tokens.vercelTeamId,
      githubToken:  maskToken(tokens.githubToken),
      configured: {
        vercel: !!tokens.vercelToken,
        github: !!tokens.githubToken,
      },
    })
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

    await saveUserTokens({
      vercelToken:  body.vercelToken  !== undefined ? (body.vercelToken  || null) : undefined,
      vercelTeamId: body.vercelTeamId !== undefined ? (body.vercelTeamId || null) : undefined,
      githubToken:  body.githubToken  !== undefined ? (body.githubToken  || null) : undefined,
    })

    return Response.json({ ok: true })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('PATCH /api/settings error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
