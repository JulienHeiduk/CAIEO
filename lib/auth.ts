import { prisma } from './prisma'

const ANON_USER = {
  clerkId: 'anonymous',
  email: 'admin@caio.local',
  name: 'Admin',
}

export async function requireUser() {
  const user = await prisma.user.upsert({
    where: { clerkId: ANON_USER.clerkId },
    update: {},
    create: ANON_USER,
  })
  return user
}
