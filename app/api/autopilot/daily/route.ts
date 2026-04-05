import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runDailyCycle } from '@/lib/autopilot'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const companyId = body.companyId as string

    if (!companyId) {
      return Response.json({ error: 'companyId is required' }, { status: 400 })
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: user.id, status: 'ACTIVE' },
    })

    if (!company) {
      return Response.json({ error: 'Company not found or not active' }, { status: 404 })
    }

    const run = await prisma.autopilotRun.create({
      data: {
        userId: user.id,
        companyId,
        companyName: company.name,
        triggerType: 'DAILY_CYCLE',
        currentStep: 5,
        ideaRaw: company.ideaPrompt,
        isValidSoftware: true,
      },
    })

    // Run in background
    runDailyCycle(run.id).catch(console.error)

    return Response.json({ id: run.id })
  } catch (err) {
    console.error('POST /api/autopilot/daily error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
