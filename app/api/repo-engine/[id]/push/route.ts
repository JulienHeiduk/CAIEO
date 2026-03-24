import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pushRepoSession } from '@/lib/repo-engine'

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

    const result = await pushRepoSession(id)
    return Response.json(result)
  } catch (err) {
    console.error('POST /api/repo-engine/[id]/push error:', err)
    return Response.json({ ok: false, error: String((err as Error).message) }, { status: 500 })
  }
}
