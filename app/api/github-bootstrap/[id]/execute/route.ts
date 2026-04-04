import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeStep } from '@/lib/github-bootstrap'

type RouteContext = { params: Promise<{ id: string }> }

type ApprovedContent = {
  repoName?: string
  description?: string
  readmeContent?: string
  changelogContent?: string
  tasksContent?: string
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const session = await prisma.gitHubBootstrap.findFirst({
      where: { id, userId: user.id },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    const body = await request.json() as {
      action: 'approve' | 'cancel'
      content?: ApprovedContent
    }

    const { action, content } = body

    if (action === 'cancel') {
      await prisma.gitHubBootstrap.update({
        where: { id },
        data: { stepStatus: 'CANCELLED' },
      })
      return Response.json({ ok: true })
    }

    if (action === 'approve') {
      // Build update data from provided content
      const updateData: Record<string, string | undefined> = {}
      if (content?.repoName !== undefined) updateData.repoName = content.repoName
      if (content?.description !== undefined) updateData.description = content.description
      if (content?.readmeContent !== undefined) updateData.readmeContent = content.readmeContent
      if (content?.changelogContent !== undefined) updateData.changelogContent = content.changelogContent
      if (content?.tasksContent !== undefined) updateData.tasksContent = content.tasksContent

      await prisma.gitHubBootstrap.update({
        where: { id },
        data: { ...updateData, stepStatus: 'EXECUTING', stepError: null },
      })

      // Fire background execution
      executeStep(id, content).catch(console.error)

      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/github-bootstrap/[id]/execute error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
