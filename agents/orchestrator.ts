import 'server-only'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { AgentType } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { AgentContext } from './types'
import { getUserTokens, getConfiguredServices } from '@/lib/settings'

interface CreateTaskInput {
  title: string
  description: string
  agentType: AgentType
  priority: number
}

const VALID_AGENT_TYPES = [
  'LANDING_PAGE', 'LINKEDIN_POST', 'TWITTER_POST', 'REDDIT_POST',
  'HACKERNEWS_POST', 'GROWTH_MARKETING', 'API_SCAFFOLD',
  'SUPABASE_SETUP', 'CLERK_SETUP', 'STRIPE_SETUP', 'RESEND_SETUP',
  'POSTHOG_SETUP', 'SENTRY_SETUP', 'FRONTEND_BUILD', 'BACKEND_BUILD',
  'VERCEL_DEPLOY', 'README_UPDATE',
]

export class OrchestratorAgent {
  private context: AgentContext

  constructor(context: AgentContext) {
    this.context = context
  }

  async generateDailyTasks(): Promise<number> {
    const recentActivity = this.context.recentLogs
      .slice(0, 20)
      .map((l) => `[${l.agentType ?? 'SYSTEM'}] ${l.summary}`)
      .join('\n')

    // Get configured integrations to inform task generation
    const tokens = await getUserTokens()
    const services = getConfiguredServices(tokens)
    const serviceList = services.length > 0
      ? `\n## Configured Integrations (available for tasks)\n${services.map(s => `- ${s}`).join('\n')}`
      : '\n## No integrations configured yet'

    const prompt = `You are the Chief AI Officer (CAIO) for ${this.context.company.name}. You run this startup autonomously.

## Company Info
Name: ${this.context.company.name}
Description: ${this.context.company.description}
Idea: ${this.context.company.ideaPrompt}
Strategy: ${this.context.company.strategy ?? 'Not yet defined'}
Landing Page: ${this.context.company.landingPageUrl ?? 'Not deployed yet'}
GitHub Repo: ${this.context.company.githubRepoUrl ?? 'Not created yet'}
${serviceList}

## Recent Activity (avoid repeating)
${recentActivity || 'No recent activity — this is day one!'}

## Available Task Types
- LANDING_PAGE — build/update the product landing page (HTML, deployed to Vercel)
- FRONTEND_BUILD — build frontend features (React/Next.js code in the repo)
- BACKEND_BUILD — build backend features (FastAPI/Node.js code in the repo)
- API_SCAFFOLD — scaffold API endpoints and data models
- SUPABASE_SETUP — create Supabase project, tables, RLS policies, edge functions
- CLERK_SETUP — configure Clerk auth, create application, set up sign-in/sign-up
- STRIPE_SETUP — configure Stripe products, prices, checkout, webhooks
- RESEND_SETUP — configure email templates, domain verification, transactional emails
- POSTHOG_SETUP — add PostHog analytics tracking, events, dashboards
- SENTRY_SETUP — add Sentry error tracking, source maps, alerts
- VERCEL_DEPLOY — deploy the application to Vercel
- README_UPDATE — update README.md with latest changes, features, setup instructions
- LINKEDIN_POST — write and publish a LinkedIn post${tokens.linkedinToken ? ' (auto-published)' : ''}
- TWITTER_POST — write and publish a tweet${tokens.twitterApiKey ? ' (auto-published)' : ''}
- REDDIT_POST — write and publish a Reddit post${tokens.redditClientId ? ' (auto-published)' : ''}
- HACKERNEWS_POST — write a Hacker News post
- GROWTH_MARKETING — create growth/marketing strategy or content

## Your Task
Generate exactly 5 high-impact tasks for today. Think like a startup CEO:
- Day 1: Focus on infrastructure setup (Supabase, Clerk, Stripe) + landing page + README
- Day 2-3: Build core features (frontend + backend) + first social posts
- Day 4+: Growth marketing, iteration, new features, more social posts
- Always include at least 1 marketing/social task after day 1
- Prioritize tasks that build on what's already done (check recent activity)
- Only use service-setup tasks if that service is configured in integrations
- Only use social posting tasks for platforms that are configured

Respond with ONLY a valid JSON array, no explanation, no markdown code blocks:
[
  {"title": "...", "description": "...", "agentType": "...", "priority": 5},
  ...
]`

    let fullText = ''

    for await (const message of query({
      prompt,
      options: { permissionMode: 'bypassPermissions', model: 'claude-opus-4-6' },
    })) {
      if (message.type === 'assistant') {
        for (const block of message.message?.content ?? []) {
          if ('text' in block) fullText += block.text
        }
      }
    }

    const jsonMatch = fullText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[orchestrator] No JSON array found in response:', fullText.slice(0, 200))
      return 0
    }

    let tasks: CreateTaskInput[] = []
    try {
      const parsed = JSON.parse(jsonMatch[0])
      tasks = parsed
        .filter((t: CreateTaskInput) => t.title && t.description && VALID_AGENT_TYPES.includes(t.agentType))
        .slice(0, 5)
    } catch (err) {
      console.error('[orchestrator] Failed to parse tasks JSON:', err)
      return 0
    }

    if (tasks.length === 0) return 0

    await prisma.task.createMany({
      data: tasks.map((t) => ({
        companyId: this.context.company.id,
        title: t.title,
        description: t.description,
        agentType: t.agentType,
        priority: t.priority ?? 3,
        scheduledFor: new Date(),
      })),
    })

    await prisma.activityLog.create({
      data: {
        companyId: this.context.company.id,
        agentType: AgentType.COMPANY_INIT,
        eventType: 'TASKS_GENERATED',
        summary: `Generated ${tasks.length} tasks for review`,
        detail: { tasks: tasks.map((t) => t.title) },
      },
    })

    return tasks.length
  }
}
