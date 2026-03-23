import { NextRequest } from 'next/server'

// Trigger.dev webhook handler for task completion callbacks
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    // Trigger.dev v3 sends events directly — no webhook signature needed for dev
    // In production, verify the webhook signature
    console.log('Trigger.dev webhook received:', payload)
    return Response.json({ received: true })
  } catch {
    return Response.json({ error: 'Invalid payload' }, { status: 400 })
  }
}
