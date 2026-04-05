import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runAutopilotPipeline, runDailyCycle } from '@/lib/autopilot'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const run = await prisma.autopilotRun.findFirst({
      where: { id, userId: user.id },
    })

    if (!run) {
      return Response.json({ error: 'Run not found' }, { status: 404 })
    }

    return Response.json({
      ...run,
      logs: JSON.parse(run.logs),
    })
  } catch (err) {
    console.error('GET /api/autopilot/[id] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()
    const body = await req.json()

    const run = await prisma.autopilotRun.findFirst({
      where: { id, userId: user.id },
    })

    if (!run) {
      return Response.json({ error: 'Run not found' }, { status: 404 })
    }

    if (body.action === 'stop') {
      await prisma.autopilotRun.update({
        where: { id },
        data: { stopRequested: true },
      })
      return Response.json({ success: true })
    }

    if (body.action === 'retry') {
      if (!['FAILED', 'STOPPED'].includes(run.stepStatus)) {
        return Response.json({ error: 'Run is not in a retryable state' }, { status: 400 })
      }
      await prisma.autopilotRun.update({
        where: { id },
        data: { stepStatus: 'RUNNING', stepError: null, stopRequested: false },
      })
      // Resume from currentStep
      if (run.triggerType === 'DAILY_CYCLE') {
        runDailyCycle(id).catch(console.error)
      } else {
        runAutopilotPipeline(id).catch(console.error)
      }
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('PATCH /api/autopilot/[id] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const run = await prisma.autopilotRun.findFirst({
      where: { id, userId: user.id },
    })

    if (!run) {
      return Response.json({ error: 'Run not found' }, { status: 404 })
    }

    await prisma.autopilotRun.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/autopilot/[id] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
