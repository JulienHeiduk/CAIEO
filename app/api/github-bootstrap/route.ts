import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startBootstrap } from '@/lib/github-bootstrap'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json() as {
      idea?: string
      repoName?: string
      visibility?: string
      localPath?: string
    }

    const { idea, repoName, visibility, localPath } = body

    if (!idea || typeof idea !== 'string' || idea.trim().length < 3) {
      return Response.json({ error: 'idea must be at least 3 characters' }, { status: 400 })
    }
    if (!localPath || typeof localPath !== 'string' || localPath.trim().length < 1) {
      return Response.json({ error: 'localPath is required' }, { status: 400 })
    }

    const session = await prisma.gitHubBootstrap.create({
      data: {
        userId: user.id,
        idea: idea.trim(),
        repoName: repoName?.trim() ?? '',
        visibility: visibility === 'public' ? 'public' : 'private',
        localPath: localPath.trim(),
        currentStep: 1,
        stepStatus: 'GENERATING',
      },
    })

    // Fire background generation
    startBootstrap(session.id).catch(console.error)

    return Response.json({ id: session.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/github-bootstrap error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
