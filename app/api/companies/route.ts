import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchGithubContext, parseGithubUrl, formatGithubContextForPrompt } from '@/lib/github'
import { CompanyInitAgent } from '@/agents/company-init-agent'

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

    const { ideaPrompt, githubRepoUrl } = body
    if (!ideaPrompt || typeof ideaPrompt !== 'string' || ideaPrompt.trim().length < 10) {
      return Response.json({ error: 'ideaPrompt must be at least 10 characters' }, { status: 400 })
    }

    // Validate GitHub URL if provided
    if (githubRepoUrl && !parseGithubUrl(githubRepoUrl)) {
      return Response.json({ error: 'Invalid GitHub repository URL' }, { status: 400 })
    }

    // Sanitize ideaPrompt to prevent prompt injection
    const sanitized = ideaPrompt.slice(0, 2000).replace(/[<>]/g, '')

    // Fetch GitHub context if URL provided
    let githubContext: string | null = null
    if (githubRepoUrl) {
      const ctx = await fetchGithubContext(githubRepoUrl)
      if (ctx) githubContext = JSON.stringify(ctx)
    }

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
        githubRepoUrl: githubRepoUrl ?? null,
        githubContext,
      },
    })

    // Run company init agent inline
    const githubContextText = githubContext
      ? formatGithubContextForPrompt(JSON.parse(githubContext))
      : null

    const agentContext = {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        description: company.description,
        ideaPrompt: company.ideaPrompt,
        strategy: null,
        landingPageUrl: null,
        githubContext: githubContextText,
      },
      recentLogs: [],
      userId: user.id,
    }

    // Run in background (don't await — return company immediately)
    new CompanyInitAgent(agentContext).run().catch(console.error)

    return Response.json({ company }, { status: 201 })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST /api/companies error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
