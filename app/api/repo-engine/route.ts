import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { scanRepo } from '@/lib/repo-engine'

function isGitRepo(repoPath: string): boolean {
  try {
    execSync(`git -C "${repoPath}" rev-parse --git-dir`, { stdio: 'pipe', timeout: 10000 })
    return true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json() as {
      repoPath?: string
      repoUrl?: string
    }

    const { repoPath, repoUrl } = body

    if (!repoPath || typeof repoPath !== 'string' || repoPath.trim().length < 1) {
      return Response.json({ error: 'repoPath is required' }, { status: 400 })
    }

    const trimmedPath = repoPath.trim()

    if (!existsSync(trimmedPath)) {
      return Response.json({ error: `Path does not exist: ${trimmedPath}` }, { status: 400 })
    }

    if (!isGitRepo(trimmedPath)) {
      return Response.json({ error: `Path is not a git repository: ${trimmedPath}` }, { status: 400 })
    }

    const repoName = path.basename(trimmedPath)

    const session = await prisma.repoSession.create({
      data: {
        userId: user.id,
        repoPath: trimmedPath,
        repoUrl: repoUrl?.trim() ?? null,
        repoName,
        contextStatus: 'PENDING',
        status: 'ACTIVE',
      },
    })

    // Fire scan in background
    scanRepo(session.id).catch(console.error)

    return Response.json({ id: session.id, session }, { status: 201 })
  } catch (err) {
    console.error('POST /api/repo-engine error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await requireUser()

    const sessions = await prisma.repoSession.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: {
        _count: { select: { repoTasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json({ sessions })
  } catch (err) {
    console.error('GET /api/repo-engine error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
