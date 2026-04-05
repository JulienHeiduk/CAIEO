import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runAutopilotPipeline } from '@/lib/autopilot'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json().catch(() => ({}))
    const manualIdea = body.idea as string | undefined

    const run = await prisma.autopilotRun.create({
      data: {
        userId: user.id,
        triggerType: 'MANUAL',
        currentStep: manualIdea ? 2 : 1,
        ideaRaw: manualIdea ?? null,
      },
    })

    // Run pipeline in background
    runAutopilotPipeline(run.id).catch(console.error)

    return Response.json({ id: run.id })
  } catch (err) {
    console.error('POST /api/autopilot error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await requireUser()

    const runs = await prisma.autopilotRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return Response.json({ runs })
  } catch (err) {
    console.error('GET /api/autopilot error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
