import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tasks } from '@trigger.dev/sdk/v3'
import { companyInitTask } from '@/jobs/company-init'

export async function GET() {
  try {
    const user = await requireUser()

    const companies = await prisma.company.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            tasks: { where: { status: 'PENDING_REVIEW' } },
            activityLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json({ companies })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()

    const { ideaPrompt } = body
    if (!ideaPrompt || typeof ideaPrompt !== 'string' || ideaPrompt.trim().length < 10) {
      return Response.json({ error: 'ideaPrompt must be at least 10 characters' }, { status: 400 })
    }

    // Sanitize ideaPrompt to prevent prompt injection
    const sanitized = ideaPrompt.slice(0, 2000).replace(/[<>]/g, '')

    // Create placeholder company (init agent will update name/strategy)
    const slug = `company-${Date.now()}`
    const company = await prisma.company.create({
      data: {
        userId: user.id,
        name: 'Initializing...',
        slug,
        description: 'Generating company profile...',
        ideaPrompt: sanitized,
        status: 'INITIALIZING',
      },
    })

    // Trigger company init job
    await tasks.trigger<typeof companyInitTask>('company-init', {
      companyId: company.id,
      userId: user.id,
    })

    return Response.json({ company }, { status: 201 })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST /api/companies error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
