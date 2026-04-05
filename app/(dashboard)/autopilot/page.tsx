import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AutopilotView } from '@/components/autopilot/AutopilotView'

export default async function AutopilotPage() {
  const user = await requireUser()

  const [runs, companies] = await Promise.all([
    prisma.autopilotRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.company.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Serialize for client
  const parsedRuns = runs.map((r) => ({
    ...r,
    logs: JSON.parse(r.logs) as string[],
    createdAt: r.createdAt.toISOString(),
  }))

  return <AutopilotView initialRuns={parsedRuns} companies={companies} />
}
