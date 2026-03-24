import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scanRepo } from '@/lib/repo-engine'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const session = await prisma.repoSession.findFirst({
      where: { id, userId: user.id },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    await prisma.repoSession.update({
      where: { id },
      data: { contextStatus: 'SCANNING' },
    })

    // Fire in background
    scanRepo(id).catch(console.error)

    return Response.json({ ok: true })
  } catch (err) {
    console.error('POST /api/repo-engine/[id]/scan error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
