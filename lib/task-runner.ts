import 'server-only'
import { execSync } from 'child_process'
import { prisma } from '@/lib/prisma'
import { TaskStatus } from '@/lib/generated/prisma'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { deployLandingPage } from '@/lib/vercel'
import { pushFileToGithub } from '@/lib/github'
import { getUserTokens } from '@/lib/settings'

// ─── Types ──────────────────────────────────────────────────────────────────

export type TaskInput = {
  id: string
  title: string
  description: string
  editedTitle: string | null
  editedDescription: string | null
  userNote: string | null
  agentType: string
  status: string
}

export type CompanyInput = {
  id: string
  name: string
  slug: string
  description: string
  strategy: string | null
  githubRepoUrl: string | null
  githubContext: string | null
}

// ─── Task-type-specific prompts ─────────────────────────────────────────────

function buildPrompt(opts: {
  company: { name: string; description: string; strategy: string | null; githubContext: string | null }
  agentType: string
  title: string
  description: string
  userNote: string
  repoPath?: string
}): string {
  const { company, agentType, title, description, userNote, repoPath } = opts
  const note = userNote ? `\n\nUser note: ${userNote}` : ''
  const github = company.githubContext ? `\n\nGitHub repository context:\n${company.githubContext}` : ''
  const repoCtx = repoPath ? `\n\nIMPORTANT: You are working in the startup's repository at: ${repoPath}
All files you create or modify MUST be written inside this directory. Use absolute paths starting with "${repoPath}/" for all Write and Edit operations.
Do NOT create files anywhere else.` : ''

  const base = `Company: ${company.name}
About: ${company.description}
Strategy: ${company.strategy ?? 'Not defined'}${github}${repoCtx}

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
${repoPath
  ? `\nWrite the file to ${repoPath}/public/landing.html (create the public/ directory if needed). Output ONLY the raw HTML.`
  : '\nIMPORTANT: Output ONLY the raw HTML. Start your response with <!DOCTYPE html> and end with </html>. No markdown, no explanation, no code fences.'}`

    case 'API_SCAFFOLD':
      return `${base}

Generate the backend API code files for this task.
${repoPath
  ? `\nCreate each file directly in the repo at ${repoPath}/ using the Write tool. Use proper directory structure (e.g., src/, lib/, etc.). Be specific and production-ready. Include all necessary types, error handling, and comments.`
  : `\nFor each file, use this exact format:
=== FILE: path/to/filename.ts ===
{file content here}
=== END FILE ===

Be specific and production-ready. Include all necessary types, error handling, and comments.`}`

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

    case 'SUPABASE_SETUP':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Set up Supabase for ${company.name}. Write the configuration and migration files directly to the repo.
Include:
- SQL migration file with tables, RLS policies, indexes
- Supabase client setup (TypeScript)
- Types generated from the schema
- .env.example with required SUPABASE_URL and SUPABASE_ANON_KEY placeholders
${repoPath ? `Write files to ${repoPath}/ using proper structure (e.g., supabase/migrations/, lib/supabase.ts).` : 'Format with === FILE: path === blocks.'}`

    case 'CLERK_SETUP':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Set up Clerk authentication for ${company.name}.
Include:
- Middleware configuration for Next.js or FastAPI
- Sign-in / sign-up components or routes
- Auth utility functions
- .env.example with CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY placeholders
${repoPath ? `Write files to ${repoPath}/.` : 'Format with === FILE: path === blocks.'}`

    case 'STRIPE_SETUP':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Set up Stripe payments for ${company.name}.
Include:
- Product and price creation script
- Checkout session API endpoint
- Webhook handler for payment events
- Customer portal configuration
- .env.example with STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET placeholders
${repoPath ? `Write files to ${repoPath}/.` : 'Format with === FILE: path === blocks.'}`

    case 'RESEND_SETUP':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Set up Resend for transactional emails for ${company.name}.
Include:
- Email sending utility with Resend SDK
- Welcome email template
- Password reset email template
- .env.example with RESEND_API_KEY placeholder
${repoPath ? `Write files to ${repoPath}/.` : 'Format with === FILE: path === blocks.'}`

    case 'POSTHOG_SETUP':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Add PostHog analytics to ${company.name}.
Include:
- PostHog provider/initialization
- Key event tracking (sign up, feature usage, conversion)
- .env.example with NEXT_PUBLIC_POSTHOG_KEY placeholder
${repoPath ? `Write files to ${repoPath}/.` : 'Format with === FILE: path === blocks.'}`

    case 'SENTRY_SETUP':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Add Sentry error tracking to ${company.name}.
Include:
- Sentry initialization (client + server)
- Error boundary component
- Source map upload config
- .env.example with SENTRY_DSN placeholder
${repoPath ? `Write files to ${repoPath}/.` : 'Format with === FILE: path === blocks.'}`

    case 'FRONTEND_BUILD':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Build the frontend feature described above for ${company.name}.
- Use React/Next.js with TypeScript
- Write clean, production-ready code
- Include proper types and error handling
- Create components, pages, and utilities as needed
${repoPath ? `Write all files to ${repoPath}/ using proper Next.js app directory structure.` : 'Format with === FILE: path === blocks.'}`

    case 'BACKEND_BUILD':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Build the backend feature described above for ${company.name}.
- Use FastAPI (Python) or Node.js/TypeScript depending on existing codebase
- Write clean, production-ready code
- Include proper types, validation, error handling
- Create routes, services, models as needed
${repoPath ? `Write all files to ${repoPath}/ using proper project structure.` : 'Format with === FILE: path === blocks.'}`

    case 'VERCEL_DEPLOY':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Prepare and configure deployment to Vercel for ${company.name}.
- Create/update vercel.json with proper config
- Ensure package.json has correct build scripts
- Add any necessary environment variable documentation
- Create .env.example with all required vars
${repoPath ? `Write files to ${repoPath}/.` : 'Format with === FILE: path === blocks.'}`

    case 'README_UPDATE':
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}` : ''}

Update the README.md for ${company.name} to reflect the current state of the project.
- Read the existing README.md and all source files to understand what's built
- Update features list, setup instructions, architecture section
- Add badges if appropriate (build status, license, version)
- Keep it professional and comprehensive
${repoPath ? `Read and update ${repoPath}/README.md.` : 'Output the full updated README.md content.'}`

    default:
      return `${base}
${repoPath ? `\nYou are working in: ${repoPath}. Write any files there.` : ''}

Complete this task. Produce the best possible output — be specific and actionable.`
  }
}

// ─── Post-processing helpers ────────────────────────────────────────────────

function extractHtml(output: string): string | null {
  const bare = output.match(/<!DOCTYPE html[\s\S]*/i) ?? output.match(/<html[\s\S]*<\/html>/i)
  if (bare) return bare[0]
  const fenced = output.match(/```(?:html)?\s*\n([\s\S]*?)\n```/i)
  if (fenced) return fenced[1]
  return null
}

function extractCodeFiles(output: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = []
  const re = /=== FILE: (.+?) ===\n([\s\S]*?)\n=== END FILE ===/g
  let m: RegExpExecArray | null
  while ((m = re.exec(output)) !== null) {
    files.push({ path: m[1].trim(), content: m[2] })
  }
  return files
}

function describeToolCall(block: { name: string; input: Record<string, unknown> }): string {
  const i = block.input
  switch (block.name) {
    case 'Write':      return `Write  ${i.file_path ?? ''}`
    case 'Edit':       return `Edit   ${i.file_path ?? ''}`
    case 'Read':       return `Read   ${i.file_path ?? ''}`
    case 'Bash':       return `$  ${String(i.command ?? '').slice(0, 80)}`
    case 'Glob':       return `Glob   ${i.pattern ?? ''}`
    case 'Grep':       return `Grep   ${i.pattern ?? ''}`
    case 'WebFetch':   return `Fetch  ${String(i.url ?? '').slice(0, 60)}`
    case 'WebSearch':  return `Search ${i.query ?? ''}`
    default:           return `${block.name}`
  }
}

// ─── Main runner ────────────────────────────────────────────────────────────

export async function runTask({ company, task, repoPath }: { company: CompanyInput; task: TaskInput; repoPath?: string }) {
  const startedAt = Date.now()
  const title = task.editedTitle ?? task.title
  const description = task.editedDescription ?? task.description
  const userNote = task.userNote ?? ''

  const tokens = await getUserTokens()

  const prompt = buildPrompt({
    company,
    agentType: task.agentType,
    title,
    description,
    userNote,
    repoPath,
  })

  const logs: string[] = []
  let output = ''
  let lastOutputFlush = 0

  const flush = async (extraFields?: Record<string, unknown>) => {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        result: JSON.parse(JSON.stringify({ logs, output, ...extraFields })),
      },
    })
  }

  const log = async (line: string, forceFlush = true) => {
    logs.push(line)
    if (forceFlush) await flush()
  }

  try {
    await log(`Agent started — ${task.agentType}`)

    for await (const message of query({
      prompt,
      options: { permissionMode: 'bypassPermissions', model: 'claude-opus-4-6' },
    })) {
      if (message.type === 'assistant') {
        for (const block of message.message?.content ?? []) {
          if (block.type === 'tool_use') {
            await log(`→ ${describeToolCall(block as { name: string; input: Record<string, unknown> })}`)
          }
          if ('text' in block && block.text) {
            output += block.text
            if (output.length - lastOutputFlush > 400) {
              lastOutputFlush = output.length
              await log(`✎ Generating… (${output.length} chars)`)
            }
          }
        }
      }
    }

    await log(`✓ Agent finished (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`)

    const result: Record<string, unknown> = { logs, output }

    if (task.agentType === 'LANDING_PAGE') {
      const html = extractHtml(output)
      if (html) {
        result.html = html
        await log('Deploying to Vercel…', false)
        const url = await deployLandingPage(html, company.slug, tokens.vercelToken)
        if (url) {
          result.deployedUrl = url
          await prisma.company.update({ where: { id: company.id }, data: { landingPageUrl: url } })
          await log(`Deployed → ${url}`, false)
        } else {
          await log('Vercel token not configured — skipped deployment', false)
        }
      } else {
        await log('Could not extract HTML from output', false)
      }
    }

    if (task.agentType === 'API_SCAFFOLD' && company.githubRepoUrl) {
      const files = extractCodeFiles(output)
      if (files.length > 0) {
        await log(`Pushing ${files.length} file(s) to GitHub…`, false)
        for (const file of files) {
          const pushed = await pushFileToGithub({
            repoUrl: company.githubRepoUrl,
            filePath: file.path,
            content: file.content,
            message: `feat: ${title} (CAIO task ${task.id.slice(0, 8)})`,
            token: tokens.githubToken,
          })
          if (pushed) await log(`  ↑ ${file.path}`, false)
        }
        result.pushedFiles = files.map((f) => f.path)
      }
    }

    // Auto-commit and push if working in a startup repo
    if (repoPath) {
      try {
        const hasChanges = execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf-8' }).trim()
        if (hasChanges) {
          const commitMsg = `feat: ${title} (CAIO task ${task.id.slice(0, 8)})`
          execSync('git add -A', { cwd: repoPath, stdio: 'pipe', timeout: 30000 })
          execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: repoPath, stdio: 'pipe', timeout: 30000 })
          await log('Committed changes to startup repo')

          try {
            execSync('git push', { cwd: repoPath, stdio: 'pipe', timeout: 60000 })
            await log('Pushed to GitHub')
          } catch {
            await log('Push failed — changes committed locally', false)
          }
        } else {
          await log('No file changes in repo — nothing to commit', false)
        }
      } catch (err) {
        await log(`Git commit error: ${(err as Error).message}`, false)
      }
    }

    // ─── Auto-publish social media posts ──────────────────────────────────────
    if (task.agentType === 'LINKEDIN_POST' && tokens.linkedinToken) {
      try {
        await log('Publishing to LinkedIn…', false)
        const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.linkedinToken}` },
        })
        const profile = await profileRes.json() as { sub?: string }
        if (profile.sub) {
          const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokens.linkedinToken}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify({
              author: `urn:li:person:${profile.sub}`,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text: output.trim() },
                  shareMediaCategory: 'NONE',
                },
              },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
            }),
          })
          if (postRes.ok) {
            await log('Published to LinkedIn', false)
            result.publishedLinkedin = true
          } else {
            await log(`LinkedIn publish failed: ${postRes.status}`, false)
          }
        }
      } catch (err) {
        await log(`LinkedIn error: ${(err as Error).message}`, false)
      }
    }

    if (task.agentType === 'TWITTER_POST' && tokens.twitterApiKey && tokens.twitterApiSecret && tokens.twitterAccessToken && tokens.twitterAccessSecret) {
      try {
        await log('Publishing to Twitter/X…', false)
        // OAuth 1.0a signature for Twitter API v2
        const timestamp = Math.floor(Date.now() / 1000).toString()
        const nonce = Math.random().toString(36).substring(2)
        const tweetText = output.trim().slice(0, 280)

        // Use OAuth 1.0a — build signature base
        const method = 'POST'
        const url = 'https://api.twitter.com/2/tweets'
        const params: Record<string, string> = {
          oauth_consumer_key: tokens.twitterApiKey,
          oauth_nonce: nonce,
          oauth_signature_method: 'HMAC-SHA1',
          oauth_timestamp: timestamp,
          oauth_token: tokens.twitterAccessToken,
          oauth_version: '1.0',
        }
        const paramString = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&')
        const sigBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
        const sigKey = `${encodeURIComponent(tokens.twitterApiSecret)}&${encodeURIComponent(tokens.twitterAccessSecret)}`

        const { createHmac } = await import('crypto')
        const signature = createHmac('sha1', sigKey).update(sigBase).digest('base64')
        params.oauth_signature = signature

        const authHeader = 'OAuth ' + Object.keys(params).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`).join(', ')

        const tweetRes = await fetch(url, {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: tweetText }),
        })
        if (tweetRes.ok) {
          const tweetData = await tweetRes.json() as { data?: { id?: string } }
          await log(`Published tweet: ${tweetData.data?.id ?? 'ok'}`, false)
          result.publishedTwitter = true
        } else {
          await log(`Twitter publish failed: ${tweetRes.status}`, false)
        }
      } catch (err) {
        await log(`Twitter error: ${(err as Error).message}`, false)
      }
    }

    if (task.agentType === 'REDDIT_POST' && tokens.redditClientId && tokens.redditClientSecret && tokens.redditUsername && tokens.redditPassword) {
      try {
        await log('Publishing to Reddit…', false)
        // Get OAuth token
        const authStr = Buffer.from(`${tokens.redditClientId}:${tokens.redditClientSecret}`).toString('base64')
        const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authStr}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': `CAIO/1.0 by ${tokens.redditUsername}`,
          },
          body: `grant_type=password&username=${encodeURIComponent(tokens.redditUsername)}&password=${encodeURIComponent(tokens.redditPassword)}`,
        })
        const tokenData = await tokenRes.json() as { access_token?: string }

        if (tokenData.access_token) {
          // Parse subreddit, title, body from output
          const subredditMatch = output.match(/SUBREDDIT:\s*r\/(\w+)/i)
          const titleMatch = output.match(/TITLE:\s*(.+)/i)
          const bodyMatch = output.match(/BODY:\s*([\s\S]+)/i)

          if (subredditMatch && titleMatch) {
            const postRes = await fetch('https://oauth.reddit.com/api/submit', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': `CAIO/1.0 by ${tokens.redditUsername}`,
              },
              body: new URLSearchParams({
                kind: 'self',
                sr: subredditMatch[1],
                title: titleMatch[1].trim(),
                text: bodyMatch?.[1]?.trim() ?? '',
              }).toString(),
            })
            if (postRes.ok) {
              await log(`Published to r/${subredditMatch[1]}`, false)
              result.publishedReddit = true
            } else {
              await log(`Reddit publish failed: ${postRes.status}`, false)
            }
          } else {
            await log('Could not parse subreddit/title from output', false)
          }
        }
      } catch (err) {
        await log(`Reddit error: ${(err as Error).message}`, false)
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
    logs.push(`✗ Failed: ${errorMessage}`)
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.FAILED,
        errorMessage,
        result: JSON.parse(JSON.stringify({ logs, output })),
      },
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
