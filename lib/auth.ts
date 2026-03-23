import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from './prisma'

export async function getAuthUser() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const user = await prisma.user.findUnique({
    where: { clerkId },
  })
  return user
}

export async function getOrCreateUser() {
  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {
      email,
      name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || null,
    },
    create: {
      clerkId: clerkUser.id,
      email,
      name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || null,
    },
  })
  return user
}

export async function requireUser() {
  const user = await getOrCreateUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
