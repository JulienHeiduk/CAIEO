import 'server-only'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { TaskStatus, CompanyStatus } from '@/lib/generated/prisma'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { CompanyInitAgent } from '@/agents/company-init-agent'
import { OrchestratorAgent } from '@/agents/orchestrator'
import { runTask } from '@/lib/task-runner'
import { getUserTokens } from '@/lib/settings'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function appendLog(runId: string, message: string) {
  const run = await prisma.autopilotRun.findUnique({ where: { id: runId } })
  if (!run) return
  const logs: string[] = JSON.parse(run.logs)
  logs.push(`[${new Date().toLocaleTimeString()}] ${message}`)
  await prisma.autopilotRun.update({
    where: { id: runId },
    data: { logs: JSON.stringify(logs) },
  })
}

async function updateStep(runId: string, data: Record<string, unknown>) {
  await prisma.autopilotRun.update({ where: { id: runId }, data: data as never })
}

async function isStopRequested(runId: string): Promise<boolean> {
  const run = await prisma.autopilotRun.findUnique({ where: { id: runId } })
  return run?.stopRequested ?? false
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Step 1: Gmail Fetch ────────────────────────────────────────────────────

async function fetchIdeaFromGmail(runId: string): Promise<string | null> {
  await appendLog(runId, 'Searching Gmail for "Idea of the Day"...')

  const gmailPrompt = `You have access to Gmail tools. Please:
1. Search for the most recent email with subject containing "Idea of the Day" using gmail_search_messages with query "subject:Idea of the Day"
2. Read the full content of the most recent result using gmail_read_message
3. Extract the core startup/product idea from the email body

Respond with ONLY valid JSON, no explanation:
{"emailSubject": "the email subject", "emailBody": "the full email body text", "ideaExtracted": "the core idea extracted, cleaned up as a concise startup pitch"}`

  let output = ''
  try {
    for await (const message of query({
      prompt: gmailPrompt,
      options: { permissionMode: 'bypassPermissions', model: 'claude-opus-4-6' },
    })) {
      if (message.type === 'assistant') {
        for (const block of (message as { type: string; message?: { content?: Array<{ type: string; text?: string }> } }).message?.content ?? []) {
          if ('text' in block && block.text) output += block.text
        }
      }
    }
  } catch (err) {
    await appendLog(runId, `Gmail fetch error: ${(err as Error).message}`)
    return null
  }

  // Parse JSON from output
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    await appendLog(runId, 'Could not parse Gmail response')
    await updateStep(runId, { stepError: 'Failed to parse Gmail response' })
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    await updateStep(runId, {
      emailSubject: parsed.emailSubject ?? null,
      emailBody: parsed.emailBody ?? null,
      ideaRaw: parsed.ideaExtracted ?? null,
    })
    await appendLog(runId, `Found email: "${parsed.emailSubject}"`)
    await appendLog(runId, `Extracted idea: ${(parsed.ideaExtracted ?? '').slice(0, 100)}...`)
    return parsed.ideaExtracted ?? null
  } catch {
    await appendLog(runId, 'Failed to parse JSON from Gmail response')
    return null
  }
}

// ─── Step 2: Software Validation ────────────────────────────────────────────

async function validateIdea(runId: string, idea: string): Promise<boolean> {
  await appendLog(runId, 'Validating idea — checking if software (not hardware)...')

  const prompt = `You are a startup classifier. Analyze this idea and determine if it is a SOFTWARE/DIGITAL product or a HARDWARE/PHYSICAL product.

Idea: ${idea}

Rules:
- Software: SaaS, apps, APIs, websites, AI tools, platforms, digital services, browser extensions, developer tools, data analytics, etc.
- Hardware: physical devices, electronics, manufacturing, robotics, chips, sensors, wearables (the device itself), IoT devices, etc.
- If the idea is primarily about building software that controls hardware, it counts as SOFTWARE.
- If the idea is primarily about manufacturing or selling physical products, it counts as HARDWARE.

Respond with ONLY valid JSON:
{"isSoftware": true or false, "category": "software" or "hardware", "reason": "one sentence explanation"}`

  let output = ''
  for await (const message of query({
    prompt,
    options: { permissionMode: 'bypassPermissions', model: 'claude-opus-4-6' },
  })) {
    if (message.type === 'assistant') {
      for (const block of (message as { type: string; message?: { content?: Array<{ type: string; text?: string }> } }).message?.content ?? []) {
        if ('text' in block && block.text) output += block.text
      }
    }
  }

  const jsonMatch = output.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    await appendLog(runId, 'Validation parse error — defaulting to valid')
    await updateStep(runId, { isValidSoftware: true, validationNote: 'Could not parse — assumed software' })
    return true
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    const isSoftware = parsed.isSoftware === true
    await updateStep(runId, {
      isValidSoftware: isSoftware,
      validationNote: parsed.reason ?? (isSoftware ? 'Software idea' : 'Hardware idea'),
    })
    if (isSoftware) {
      await appendLog(runId, `Validated: SOFTWARE — ${parsed.reason}`)
    } else {
      await appendLog(runId, `Rejected: HARDWARE — ${parsed.reason}`)
    }
    return isSoftware
  } catch {
    await appendLog(runId, 'Validation parse error — defaulting to valid')
    await updateStep(runId, { isValidSoftware: true, validationNote: 'Parse error — assumed software' })
    return true
  }
}

// ─── Step 3: Company Creation ───────────────────────────────────────────────

async function createCompany(runId: string, userId: string, idea: string): Promise<string | null> {
  await appendLog(runId, 'Creating company from idea...')

  // Load TechnicalStack.md
  let techStack = ''
  try {
    const techStackPath = path.resolve(process.cwd(), 'docs/TechnicalStack.md')
    techStack = readFileSync(techStackPath, 'utf-8')
  } catch {
    await appendLog(runId, 'TechnicalStack.md not found — proceeding without it')
  }

  const launchPlan = `## Preferred Technical Stack
${techStack || 'Not specified — use best practices for a modern SaaS stack.'}

## Startup Launch Plan Template
Structure the growth strategy as a concrete launch plan with these sections:

### 1. Product Vision & MVP
- Core value proposition (one sentence)
- MVP features (3-5 bullet points — ship in 2 weeks)
- What is explicitly OUT of scope for v1

### 2. Technical Architecture
- Use the tech stack above — map each tool to its role
- Key integrations and data flow
- Deployment strategy (CI/CD, staging, production)

### 3. Go-to-Market (First 30 Days)
- Target audience (specific persona, not generic)
- Distribution channels ranked by expected ROI
- Launch day plan (where to post, what to say)
- Pricing strategy (free tier? freemium? paid only?)

### 4. Growth Engine (Days 30-90)
- Content strategy (topics, formats, cadence)
- Community building approach
- Key metrics and targets (MRR, users, retention)
- Paid acquisition: when to start and budget

### 5. Daily Operations for CAIO
- Which 5 task types should CAIO prioritize each day?
- What should be automated vs. human-reviewed?
- Key milestones and decision points

Be specific, actionable, and realistic. No generic advice.`

  const enrichedIdea = `${idea}\n\n${launchPlan}`

  // Create placeholder company
  const tempSlug = `autopilot-${Date.now()}`
  const company = await prisma.company.create({
    data: {
      userId,
      name: 'Initializing...',
      slug: tempSlug,
      description: 'Autopilot is creating this company...',
      ideaPrompt: enrichedIdea,
      status: CompanyStatus.INITIALIZING,
    },
  })

  await updateStep(runId, { companyId: company.id })
  await appendLog(runId, `Company record created (${company.id.slice(0, 8)}...)`)

  // Run CompanyInitAgent
  const recentLogs = await prisma.activityLog.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const agent = new CompanyInitAgent({
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      description: company.description,
      ideaPrompt: enrichedIdea,
      strategy: null,
      landingPageUrl: null,
    },
    recentLogs,
    userId,
  })

  const result = await agent.run()

  if (!result.success) {
    await appendLog(runId, `CompanyInitAgent failed: ${result.error}`)
    return null
  }

  // Re-read company to get updated name
  const updated = await prisma.company.findUnique({ where: { id: company.id } })
  if (updated) {
    await updateStep(runId, { companyName: updated.name })
    await appendLog(runId, `Company created: "${updated.name}"`)
  }

  return company.id
}

// ─── Step 4: Bootstrap GitHub Repo ──────────────────────────────────────────

async function generateTextForBootstrap(prompt: string): Promise<string> {
  let output = ''
  for await (const message of query({
    prompt,
    options: { permissionMode: 'bypassPermissions', model: 'claude-opus-4-6' },
  })) {
    if (message.type === 'assistant') {
      for (const block of (message as { type: string; message?: { content?: Array<{ type: string; text?: string }> } }).message?.content ?? []) {
        if ('text' in block && block.text) output += block.text
      }
    }
  }
  return output.trim()
}

async function bootstrapGithubRepo(runId: string, companyId: string): Promise<boolean> {
  await appendLog(runId, 'Bootstrapping GitHub repository...')

  const tokens = await getUserTokens()
  const githubToken = tokens.githubToken
  if (!githubToken) {
    await appendLog(runId, 'GitHub token not configured — skipping repo bootstrap')
    return true
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return false

  const repoName = company.slug
  const idea = company.ideaPrompt
  const description = company.description

  // 1. Create GitHub repo
  await appendLog(runId, `Creating GitHub repo: ${repoName}...`)
  const resp = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: repoName,
      description,
      private: true,
      auto_init: false,
    }),
  })

  const data = await resp.json() as { html_url?: string; full_name?: string; message?: string }
  if (!resp.ok) {
    if (resp.status === 422) {
      await appendLog(runId, `Repo "${repoName}" already exists — linking it`)
      const userResp = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' },
      })
      const userData = await userResp.json() as { login?: string }
      const existingUrl = `https://github.com/${userData.login}/${repoName}`
      await prisma.company.update({ where: { id: companyId }, data: { githubRepoUrl: existingUrl } })
      await updateStep(runId, { repoUrl: existingUrl })
      return true
    }
    await appendLog(runId, `GitHub error: ${data.message ?? resp.statusText}`)
    return true
  }

  const repoUrl = data.html_url ?? ''
  const fullName = data.full_name ?? ''
  await appendLog(runId, `Repo created: ${repoUrl}`)

  // 2. Clone locally
  const localParent = path.resolve(process.cwd(), '..')
  const localPath = path.join(localParent, repoName)
  await appendLog(runId, `Cloning to ${localPath}...`)

  try {
    const cloneUrl = `https://oauth2:${githubToken}@github.com/${fullName}.git`
    execSync(`git clone "${cloneUrl}" "${localPath}"`, { stdio: 'pipe', timeout: 60000 })
  } catch (err) {
    await appendLog(runId, `Clone failed: ${(err as Error).message}`)
    await prisma.company.update({ where: { id: companyId }, data: { githubRepoUrl: repoUrl } })
    await updateStep(runId, { repoUrl })
    return true
  }

  // 3. Generate README
  await appendLog(runId, 'Generating README.md...')
  const readmeContent = await generateTextForBootstrap(
    `You are a technical writer. Generate a complete README.md for this project.

Project name: ${repoName}
Description: ${description}
Original idea: ${idea}

Include sections: description, objective, technical stack, getting started, roadmap (link to TASKS.md), changelog (link to CHANGELOG.md), license (MIT).
Output ONLY raw markdown, no code fences.`
  )

  // 4. Generate CHANGELOG
  const today = new Date().toISOString().split('T')[0]
  const changelogContent = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n## [0.1.0] — ${today}\n\n### Added\n- Project initialized from idea by Chief AI Officer\n- README.md, CHANGELOG.md, TASKS.md\n`

  // 5. Generate TASKS.md
  await appendLog(runId, 'Generating TASKS.md...')
  const tasksContent = await generateTextForBootstrap(
    `You are a senior project manager. Generate exactly 5 initial tasks for this project.

Project: ${repoName}
Description: ${description}
Idea: ${idea}

Task 1: technical setup (deps, config, file structure)
Task 2: core MVP feature
Task 3: secondary feature or key integration
Task 4: tests or validation
Task 5: documentation or polish

Use markdown with checkboxes. Output ONLY raw markdown, no code fences.`
  )

  // 6. Write files, commit, push
  await appendLog(runId, 'Writing files and pushing to GitHub...')
  try {
    writeFileSync(path.join(localPath, 'README.md'), readmeContent, 'utf-8')
    writeFileSync(path.join(localPath, 'CHANGELOG.md'), changelogContent, 'utf-8')
    writeFileSync(path.join(localPath, 'TASKS.md'), tasksContent, 'utf-8')

    execSync('git add README.md CHANGELOG.md TASKS.md', { cwd: localPath, stdio: 'pipe', timeout: 60000 })
    execSync('git commit -m "feat: initial project bootstrap by Chief AI Officer"', { cwd: localPath, stdio: 'pipe', timeout: 60000 })

    const pushUrl = `https://oauth2:${githubToken}@github.com/${fullName}.git`
    execSync(`git push "${pushUrl}" HEAD:main`, { cwd: localPath, stdio: 'pipe', timeout: 60000 })

    await appendLog(runId, `Pushed to ${repoUrl}`)
  } catch (err) {
    await appendLog(runId, `Git push failed: ${(err as Error).message}`)
  }

  // Link repo to company
  await prisma.company.update({ where: { id: companyId }, data: { githubRepoUrl: repoUrl } })
  await updateStep(runId, { repoUrl, repoLocalPath: localPath })
  await appendLog(runId, 'GitHub repo bootstrapped successfully')

  return true
}

// ─── Step 5: Task Generation ────────────────────────────────────────────────

async function generateTasks(runId: string, companyId: string, userId: string): Promise<number> {
  await appendLog(runId, 'Generating 5 tasks...')

  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) {
    await appendLog(runId, 'Company not found')
    return 0
  }

  const recentLogs = await prisma.activityLog.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const orchestrator = new OrchestratorAgent({
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      description: company.description,
      ideaPrompt: company.ideaPrompt,
      strategy: company.strategy,
      landingPageUrl: company.landingPageUrl,
      githubRepoUrl: company.githubRepoUrl,
    },
    recentLogs,
    userId,
  })

  const count = await orchestrator.generateDailyTasks()

  if (count === 0) {
    await appendLog(runId, 'No tasks generated — AI returned invalid data')
    return 0
  }

  // Auto-approve all generated tasks
  const pendingTasks = await prisma.task.findMany({
    where: { companyId, status: TaskStatus.PENDING_REVIEW },
    orderBy: { createdAt: 'desc' },
    take: count,
  })

  await prisma.task.updateMany({
    where: { id: { in: pendingTasks.map((t) => t.id) } },
    data: { status: TaskStatus.APPROVED, approvedAt: new Date() },
  })

  await updateStep(runId, { tasksGenerated: count, tasksTotal: count })
  await appendLog(runId, `Generated and auto-approved ${count} tasks`)

  for (const t of pendingTasks) {
    await appendLog(runId, `  — ${t.title}`)
  }

  return count
}

// ─── Step 6: Sequential Execution ───────────────────────────────────────────

async function executeTasks(runId: string, companyId: string): Promise<void> {
  await appendLog(runId, 'Starting sequential task execution...')

  const run = await prisma.autopilotRun.findUnique({ where: { id: runId } })
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return

  const repoPath = run?.repoLocalPath ?? undefined
  if (repoPath) {
    await appendLog(runId, `Working in startup repo: ${repoPath}`)
  }

  const tasks = await prisma.task.findMany({
    where: { companyId, status: TaskStatus.APPROVED },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })

  await updateStep(runId, { tasksTotal: tasks.length, tasksCompleted: 0 })

  for (let i = 0; i < tasks.length; i++) {
    // Check for stop
    if (await isStopRequested(runId)) {
      await appendLog(runId, 'Stop requested — halting between tasks')
      await updateStep(runId, { stepStatus: 'STOPPED' })
      return
    }

    const task = tasks[i]
    await appendLog(runId, `Executing task ${i + 1}/${tasks.length}: ${task.title}`)
    await updateStep(runId, { currentTaskId: task.id })

    // Mark as EXECUTING
    await prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.EXECUTING } })

    // Run the task in the startup's repo
    await runTask({
      company,
      task: { ...task, status: 'EXECUTING' as string, agentType: task.agentType as string },
      repoPath,
    })

    // Check result
    const completed = await prisma.task.findUnique({ where: { id: task.id } })
    const status = completed?.status === TaskStatus.COMPLETED ? 'completed' : 'failed'
    await appendLog(runId, `Task ${i + 1} ${status}: ${task.title}`)
    await updateStep(runId, { tasksCompleted: i + 1 })

    // Delay between tasks (3 seconds)
    if (i < tasks.length - 1) {
      await sleep(3000)
    }
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

export async function runAutopilotPipeline(runId: string) {
  const run = await prisma.autopilotRun.findUnique({ where: { id: runId } })
  if (!run) return

  try {
    // Step 1: Gmail Fetch
    if (run.currentStep <= 1) {
      await updateStep(runId, { currentStep: 1, stepStatus: 'RUNNING' })
      const idea = await fetchIdeaFromGmail(runId)
      if (!idea) {
        await updateStep(runId, { stepStatus: 'FAILED', stepError: 'Could not fetch idea from Gmail' })
        return
      }
      await updateStep(runId, { currentStep: 2 })
    }

    // Step 2: Validate
    if (run.currentStep <= 2) {
      await updateStep(runId, { currentStep: 2, stepStatus: 'RUNNING' })
      const freshRun = await prisma.autopilotRun.findUnique({ where: { id: runId } })
      const idea = freshRun?.ideaRaw
      if (!idea) {
        await updateStep(runId, { stepStatus: 'FAILED', stepError: 'No idea to validate' })
        return
      }
      const isValid = await validateIdea(runId, idea)
      if (!isValid) {
        await updateStep(runId, { stepStatus: 'FAILED', stepError: 'Idea rejected — hardware, not software' })
        return
      }
      await updateStep(runId, { currentStep: 3 })
    }

    // Step 3: Create Company
    if (run.currentStep <= 3) {
      await updateStep(runId, { currentStep: 3, stepStatus: 'RUNNING' })
      const freshRun = await prisma.autopilotRun.findUnique({ where: { id: runId } })
      const companyId = await createCompany(runId, run.userId, freshRun?.ideaRaw ?? '')
      if (!companyId) {
        await updateStep(runId, { stepStatus: 'FAILED', stepError: 'Company creation failed' })
        return
      }
      await updateStep(runId, { currentStep: 4, companyId })
    }

    // Step 4: Bootstrap GitHub Repo
    if (run.currentStep <= 4) {
      await updateStep(runId, { currentStep: 4, stepStatus: 'RUNNING' })
      const freshRun = await prisma.autopilotRun.findUnique({ where: { id: runId } })
      if (!freshRun?.companyId) {
        await updateStep(runId, { stepStatus: 'FAILED', stepError: 'No company to bootstrap repo for' })
        return
      }
      await bootstrapGithubRepo(runId, freshRun.companyId)
      await updateStep(runId, { currentStep: 5 })
    }

    // Step 5: Generate Tasks
    if (run.currentStep <= 5) {
      await updateStep(runId, { currentStep: 5, stepStatus: 'RUNNING' })
      const freshRun = await prisma.autopilotRun.findUnique({ where: { id: runId } })
      if (!freshRun?.companyId) {
        await updateStep(runId, { stepStatus: 'FAILED', stepError: 'No company to generate tasks for' })
        return
      }
      const count = await generateTasks(runId, freshRun.companyId, run.userId)
      if (count === 0) {
        await updateStep(runId, { stepStatus: 'FAILED', stepError: 'Task generation failed' })
        return
      }
      await updateStep(runId, { currentStep: 6 })
    }

    // Step 6: Execute Tasks
    if (run.currentStep <= 6) {
      await updateStep(runId, { currentStep: 6, stepStatus: 'RUNNING' })
      const freshRun = await prisma.autopilotRun.findUnique({ where: { id: runId } })
      if (!freshRun?.companyId) {
        await updateStep(runId, { stepStatus: 'FAILED', stepError: 'No company for task execution' })
        return
      }

      if (await isStopRequested(runId)) {
        await updateStep(runId, { stepStatus: 'STOPPED' })
        return
      }

      await executeTasks(runId, freshRun.companyId)

      // Check final status
      const finalRun = await prisma.autopilotRun.findUnique({ where: { id: runId } })
      if (finalRun?.stepStatus !== 'STOPPED') {
        await updateStep(runId, { stepStatus: 'COMPLETED' })
        await appendLog(runId, 'Pipeline completed successfully')
      }
    }
  } catch (err) {
    await appendLog(runId, `Pipeline error: ${(err as Error).message}`)
    await updateStep(runId, { stepStatus: 'FAILED', stepError: (err as Error).message })
  }
}

// ─── Daily Cycle (skip steps 1-3) ───────────────────────────────────────────

export async function runDailyCycle(runId: string) {
  const run = await prisma.autopilotRun.findUnique({ where: { id: runId } })
  if (!run || !run.companyId) return

  try {
    // Step 5: Generate Tasks
    await updateStep(runId, { currentStep: 5, stepStatus: 'RUNNING' })
    const count = await generateTasks(runId, run.companyId, run.userId)
    if (count === 0) {
      await updateStep(runId, { stepStatus: 'FAILED', stepError: 'Task generation failed' })
      return
    }
    await updateStep(runId, { currentStep: 6 })

    // Step 6: Execute Tasks
    await updateStep(runId, { currentStep: 6, stepStatus: 'RUNNING' })

    if (await isStopRequested(runId)) {
      await updateStep(runId, { stepStatus: 'STOPPED' })
      return
    }

    await executeTasks(runId, run.companyId)

    const finalRun = await prisma.autopilotRun.findUnique({ where: { id: runId } })
    if (finalRun?.stepStatus !== 'STOPPED') {
      await updateStep(runId, { stepStatus: 'COMPLETED' })
      await appendLog(runId, 'Daily cycle completed')
    }
  } catch (err) {
    await appendLog(runId, `Daily cycle error: ${(err as Error).message}`)
    await updateStep(runId, { stepStatus: 'FAILED', stepError: (err as Error).message })
  }
}
