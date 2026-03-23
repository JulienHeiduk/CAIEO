import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CompanyStatus } from '@/lib/generated/prisma'
import { fetchGithubContext, parseGithubUrl } from '@/lib/github'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const company = await prisma.company.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: {
          select: { tasks: true, activityLogs: true },
        },
      },
    })

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }

    return Response.json({ company })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()
    const body = await request.json()

    const company = await prisma.company.findFirst({
      where: { id, userId: user.id },
    })

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }

    const updateData: { status?: CompanyStatus; strategy?: string; githubRepoUrl?: string | null; githubContext?: string | null } = {}
    if ('status' in body && Object.values(CompanyStatus).includes(body.status)) {
      updateData.status = body.status as CompanyStatus
    }
    if ('strategy' in body && typeof body.strategy === 'string') {
      updateData.strategy = body.strategy
    }
    if ('githubRepoUrl' in body) {
      const url = body.githubRepoUrl as string | null
      if (url && !parseGithubUrl(url)) {
        return Response.json({ error: 'Invalid GitHub repository URL' }, { status: 400 })
      }
      updateData.githubRepoUrl = url
      if (url) {
        const ctx = await fetchGithubContext(url)
        updateData.githubContext = ctx ? JSON.stringify(ctx) : null
      } else {
        updateData.githubContext = null
      }
    }

    const updated = await prisma.company.update({
      where: { id },
      data: updateData,
    })

    return Response.json({ company: updated })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const company = await prisma.company.findFirst({
      where: { id, userId: user.id },
    })

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }

    // Delete in dependency order (no cascade set in schema)
    await prisma.agentRun.deleteMany({ where: { companyId: id } })
    await prisma.activityLog.deleteMany({ where: { companyId: id } })
    await prisma.task.deleteMany({ where: { companyId: id } })
    await prisma.company.delete({ where: { id } })

    return Response.json({ success: true })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
