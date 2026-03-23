import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskStatus } from '@/lib/generated/prisma'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { deployLandingPage } from '@/lib/vercel'
import { pushFileToGithub } from '@/lib/github'
import { getUserTokens } from '@/lib/settings'

type RouteContext = { params: Promise<{ id: string; tid: string }> }

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id, tid } = await params
    const user = await requireUser()

    const company = await prisma.company.findFirst({
      where: { id, userId: user.id },
    })
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 })

    const task = await prisma.task.findFirst({ where: { id: tid, companyId: id } })
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 })
    if (task.status !== TaskStatus.APPROVED) {
      return Response.json({ error: `Task must be APPROVED (current: ${task.status})` }, { status: 400 })
    }

    // Mark as EXECUTING immediately
    await prisma.task.update({ where: { id: tid }, data: { status: TaskStatus.EXECUTING } })

    // Run agent in background
    runTask({ company, task: { ...task, status: TaskStatus.EXECUTING } }).catch(console.error)

    return Response.json({ success: true })
  } catch (err) {
    console.error('POST execute error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Task-type-specific prompts ──────────────────────────────────────────────

function buildPrompt(opts: {
  company: { name: string; description: string; strategy: string | null; githubContext: string | null }
  agentType: string
  title: string
  description: string
  userNote: string
}): string {
  const { company, agentType, title, description, userNote } = opts
  const note = userNote ? `\n\nUser note: ${userNote}` : ''
  const github = company.githubContext ? `\n\nGitHub repository context:\n${company.githubContext}` : ''

  const base = `Company: ${company.name}
About: ${company.description}
Strategy: ${company.strategy ?? 'Not defined'}${github}

Task: ${title}
Details: ${description}${note}`

  switch (agentType) {
    case 'LANDING_PAGE':
      return `${base}

Generate a complete, production-ready, single-file HTML landing page for ${company.name}.

Requirements:
- Self-contained HTML with inline CSS and inline JS (no external dependencies except Google Fonts via @import in style tag)
- Modern, clean design — hero section, features/benefits, call to action, footer
- Responsive (mobile-first)
- Compelling copy that matches the company description and strategy
- Professional color scheme

IMPORTANT: Output ONLY the raw HTML. Start your response with <!DOCTYPE html> and end with </html>. No markdown, no explanation, no code fences.`

    case 'API_SCAFFOLD':
      return `${base}

Generate the backend API code files for this task.

For each file, use this exact format:
=== FILE: path/to/filename.ts ===
{file content here}
=== END FILE ===

Be specific and production-ready. Include all necessary types, error handling, and comments.`

    case 'LINKEDIN_POST':
      return `${base}

Write a compelling LinkedIn post for ${company.name}.
- Professional yet engaging tone
- 150–300 words
- End with 3–5 relevant hashtags
- Focus on value, insight, or a story — not just promotion`

    case 'TWITTER_POST':
      return `${base}

Write a tweet for ${company.name}.
- Maximum 280 characters
- Punchy, engaging, authentic
- 1–2 relevant hashtags
- No fluff`

    case 'REDDIT_POST':
      return `${base}

Write a Reddit post for ${company.name}.
- Suggest the best subreddit to post in
- Write a title and body that fits the Reddit community tone
- Be genuine and add value — no overt promotion
- Format the output as:

SUBREDDIT: r/...
TITLE: ...
BODY:
...`

    case 'HACKERNEWS_POST':
      return `${base}

Write a Show HN / Ask HN post for ${company.name}.
- HN title (under 80 chars, no marketing speak)
- Body: honest, technical, to the point
- Format:

TITLE: ...
BODY:
...`

    case 'GROWTH_MARKETING':
      return `${base}

Create a detailed growth marketing plan for ${company.name}.
Include:
1. Target audience and key channels
2. Content strategy (topics, formats, cadence)
3. Distribution tactics (SEO, social, partnerships, communities)
4. Early traction experiments (quick wins)
5. KPIs and success metrics

Be specific and actionable. Format as markdown.`

    case 'KAGGLE_POST':
      return `${base}

Write a Kaggle community post or competition strategy for ${company.name}.
Include dataset suggestions, approach, and how to position in the community.`

    default:
      return `${base}

Complete this task. Produce the best possible output — be specific and actionable.`
  }
}

// ─── Post-processing: deploy / push generated artifacts ──────────────────────

/** Extract raw HTML from model output (handles both bare HTML and fenced blocks) */
function extractHtml(output: string): string | null {
  // Bare HTML (starts with <!DOCTYPE or <html)
  const bare = output.match(/<!DOCTYPE html[\s\S]*/i) ?? output.match(/<html[\s\S]*<\/html>/i)
  if (bare) return bare[0]
  // Fenced code block
  const fenced = output.match(/```(?:html)?\s*\n([\s\S]*?)\n```/i)
  if (fenced) return fenced[1]
  return null
}

/** Parse === FILE: path === ... === END FILE === blocks */
function extractCodeFiles(output: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = []
  const re = /=== FILE: (.+?) ===\n([\s\S]*?)\n=== END FILE ===/g
  let m: RegExpExecArray | null
  while ((m = re.exec(output)) !== null) {
    files.push({ path: m[1].trim(), content: m[2] })
  }
  return files
}

// ─── Main runner ─────────────────────────────────────────────────────────────

type TaskInput = {
  id: string
  title: string
  description: string
  editedTitle: string | null
  editedDescription: string | null
  userNote: string | null
  agentType: string
  status: string
}

type CompanyInput = {
  id: string
  name: string
  slug: string
  description: string
  strategy: string | null
  githubRepoUrl: string | null
  githubContext: string | null
}

async function runTask({ company, task }: { company: CompanyInput; task: TaskInput }) {
  const startedAt = Date.now()
  const title = task.editedTitle ?? task.title
  const description = task.editedDescription ?? task.description
  const userNote = task.userNote ?? ''

  // Load tokens from DB (falls back to env vars)
  const tokens = await getUserTokens()

  const prompt = buildPrompt({
    company,
    agentType: task.agentType,
    title,
    description,
    userNote,
  })

  let output = ''
  try {
    for await (const message of query({
      prompt,
      options: { permissionMode: 'bypassPermissions' },
    })) {
      if (message.type === 'assistant') {
        for (const block of message.message?.content ?? []) {
          if ('text' in block) output += block.text
        }
      }
    }

    // ── Post-process by task type ──
    const result: Record<string, unknown> = { output }

    if (task.agentType === 'LANDING_PAGE') {
      const html = extractHtml(output)
      if (html) {
        result.html = html
        const url = await deployLandingPage(html, company.slug, tokens.vercelToken)
        if (url) {
          result.deployedUrl = url
          // Persist to company record
          await prisma.company.update({
            where: { id: company.id },
            data: { landingPageUrl: url },
          })
          console.log(`[vercel] landing page deployed: ${url}`)
        }
      } else {
        console.warn('[execute] LANDING_PAGE: could not extract HTML from output')
      }
    }

    if (task.agentType === 'API_SCAFFOLD' && company.githubRepoUrl) {
      const files = extractCodeFiles(output)
      if (files.length > 0) {
        for (const file of files) {
          const pushed = await pushFileToGithub({
            repoUrl: company.githubRepoUrl,
            filePath: file.path,
            content: file.content,
            message: `feat: ${title} (CAIO task ${task.id.slice(0, 8)})`,
            token: tokens.githubToken,
          })
          if (pushed) console.log(`[github] pushed ${file.path}`)
        }
        result.pushedFiles = files.map((f) => f.path)
      }
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.COMPLETED,
        executedAt: new Date(),
        result: JSON.parse(JSON.stringify(result)),
      },
    })

    await prisma.activityLog.create({
      data: {
        companyId: company.id,
        taskId: task.id,
        agentType: task.agentType as never,
        eventType: 'TASK_COMPLETED',
        summary: `Completed: ${title}`,
        detail: JSON.parse(JSON.stringify({
          durationMs: Date.now() - startedAt,
          outputLength: output.length,
          deployedUrl: (result.deployedUrl as string) ?? null,
          pushedFiles: (result.pushedFiles as string[]) ?? null,
        })),
      },
    })
  } catch (err) {
    const errorMessage = (err as Error).message
    await prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.FAILED, errorMessage },
    })
    await prisma.activityLog.create({
      data: {
        companyId: company.id,
        taskId: task.id,
        agentType: task.agentType as never,
        eventType: 'TASK_FAILED',
        summary: `Failed: ${title}`,
        detail: JSON.parse(JSON.stringify({ error: errorMessage })),
      },
    })
  }
}
