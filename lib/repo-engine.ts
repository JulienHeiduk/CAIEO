import 'server-only'

import { execSync } from 'child_process'
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'fs'
import path from 'path'
import { prisma } from './prisma'
import { getUserTokens } from './settings'
import { query } from '@anthropic-ai/claude-agent-sdk'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeRead(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

/** Build a directory tree string up to maxDepth levels deep */
function buildDirTree(dirPath: string, maxDepth = 3, prefix = '', depth = 0): string {
  if (depth > maxDepth) return ''
  let result = ''
  try {
    const entries = readdirSync(dirPath)
    const filtered = entries.filter((e) => !['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv', 'target'].includes(e))
    for (const entry of filtered.slice(0, 30)) {
      const fullPath = path.join(dirPath, entry)
      const isDir = statSync(fullPath).isDirectory()
      result += `${prefix}${isDir ? '📁 ' : '  '}${entry}\n`
      if (isDir && depth < maxDepth) {
        result += buildDirTree(fullPath, maxDepth, prefix + '  ', depth + 1)
      }
    }
  } catch {
    // ignore permission errors
  }
  return result
}

/** Find main source files (up to 3) */
function findMainSourceFiles(repoPath: string): string[] {
  const candidates = [
    'index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js',
    'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.py', 'main.py',
  ]
  const found: string[] = []
  for (const c of candidates) {
    const fp = path.join(repoPath, c)
    if (existsSync(fp) && found.length < 3) found.push(fp)
  }
  return found
}

/** Generate text from Claude */
async function generateText(prompt: string): Promise<string> {
  let output = ''
  for await (const message of query({
    prompt,
    options: { permissionMode: 'bypassPermissions' },
  })) {
    if (message.type === 'assistant') {
      for (const block of (message as { type: string; message?: { content?: Array<{ type: string; text?: string }> } }).message?.content ?? []) {
        if ('text' in block && block.text) {
          output += block.text
        }
      }
    }
  }
  return output.trim()
}

/** Tool call descriptor */
function describeToolCall(block: { name: string; input: Record<string, unknown> }): string {
  const i = block.input
  switch (block.name) {
    case 'Write':    return `Write  ${i.file_path ?? ''}`
    case 'Edit':     return `Edit   ${i.file_path ?? ''}`
    case 'Read':     return `Read   ${i.file_path ?? ''}`
    case 'Bash':     return `$  ${String(i.command ?? '').slice(0, 80)}`
    case 'Glob':     return `Glob   ${i.pattern ?? ''}`
    case 'Grep':     return `Grep   ${i.pattern ?? ''}`
    default:         return `${block.name}`
  }
}

// ─── scanRepo ─────────────────────────────────────────────────────────────────

export async function scanRepo(sessionId: string): Promise<void> {
  try {
    await prisma.repoSession.update({
      where: { id: sessionId },
      data: { contextStatus: 'SCANNING' },
    })

    const session = await prisma.repoSession.findUniqueOrThrow({ where: { id: sessionId } })
    const { repoPath, repoName } = session

    // Build file tree
    const tree = buildDirTree(repoPath, 3)

    // Read key files
    const spec = safeRead(path.join(repoPath, 'SPEC.md')) ?? safeRead(path.join(repoPath, 'spec.md')) ?? safeRead(path.join(repoPath, 'SPEC'))
    const readme = safeRead(path.join(repoPath, 'README.md')) ?? safeRead(path.join(repoPath, 'readme.md'))
    const changelog = safeRead(path.join(repoPath, 'CHANGELOG.md'))
    const tasks = safeRead(path.join(repoPath, 'TASKS.md'))
    const pkgJson = safeRead(path.join(repoPath, 'package.json'))
    const pyProject = safeRead(path.join(repoPath, 'pyproject.toml'))
    const cargoToml = safeRead(path.join(repoPath, 'Cargo.toml'))

    // Main source files
    const sourceFiles = findMainSourceFiles(repoPath)
    let sourceContent = ''
    for (const fp of sourceFiles) {
      const content = safeRead(fp)
      if (content) {
        const relativePath = path.relative(repoPath, fp)
        sourceContent += `\n\n--- ${relativePath} ---\n${content.slice(0, 1500)}`
      }
    }

    const prompt = `You are a senior software architect analyzing a repository.

Repository name: ${repoName}
Local path: ${repoPath}

## Directory structure (max depth 3)
\`\`\`
${tree}
\`\`\`

${spec ? `## SPEC.md\n${spec.slice(0, 3000)}\n` : ''}
${readme ? `## README.md\n${readme.slice(0, 2000)}\n` : ''}
${changelog ? `## CHANGELOG.md (last 2000 chars)\n${changelog.slice(-2000)}\n` : ''}
${tasks ? `## TASKS.md\n${tasks.slice(0, 2000)}\n` : ''}
${pkgJson ? `## package.json\n${pkgJson.slice(0, 1500)}\n` : ''}
${pyProject ? `## pyproject.toml\n${pyProject.slice(0, 1000)}\n` : ''}
${cargoToml ? `## Cargo.toml\n${cargoToml.slice(0, 1000)}\n` : ''}
${sourceContent ? `## Main source files\n${sourceContent}\n` : ''}

Produce a structured context summary in this exact markdown format:

## Project Context: ${repoName}
**Stack**: {languages, frameworks, tools detected}
**State**: {blank | early-stage | in-development | mature}
**Spec summary**: {brief summary of SPEC.md if present, else "No spec found"}
**Recent changelog**: {summary of recent changelog entries if present, else "No changelog"}
**In-progress tasks**: {summary from TASKS.md if present, else "No active tasks"}
**Points of attention**: {TODOs in code, missing tests, tech debt, anything requiring attention}

Be concise but informative. This summary will be used to generate development tasks.`

    const contextSummary = await generateText(prompt)

    await prisma.repoSession.update({
      where: { id: sessionId },
      data: { contextSummary, contextStatus: 'READY' },
    })
  } catch (err) {
    console.error('scanRepo error:', err)
    await prisma.repoSession.update({
      where: { id: sessionId },
      data: { contextStatus: 'ERROR' },
    })
  }
}

// ─── generateCycleTasks ────────────────────────────────────────────────────────

export async function generateCycleTasks(sessionId: string): Promise<void> {
  try {
    const session = await prisma.repoSession.findUniqueOrThrow({ where: { id: sessionId } })
    const { repoPath, repoName, contextSummary, currentCycle } = session

    const changelog = safeRead(path.join(repoPath, 'CHANGELOG.md'))
    const tasks = safeRead(path.join(repoPath, 'TASKS.md'))

    const prompt = `You are an AI engineering lead for the project "${repoName}".

${contextSummary ? `## Project Context\n${contextSummary}\n` : ''}
${changelog ? `## Current CHANGELOG.md\n${changelog.slice(-3000)}\n` : ''}
${tasks ? `## Previous TASKS.md\n${tasks.slice(0, 2000)}\n` : ''}

This is cycle ${currentCycle}. Generate EXACTLY 5 actionable development tasks for this project.

Rules:
- Each task must be atomic (one clear objective, one commit)
- Each task must be implementable by an AI coding agent (writing code, modifying files, configs)
- Tasks must be ordered by priority (task 1 is most urgent)
- No vague tasks — always a precise deliverable
- Avoid duplicating recently completed work (check changelog)
- If the project is blank: setup → core → integration → tests → documentation
- If in development: fix bugs, add features, improve tests, refactor, add docs

Respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "tasks": [
    {
      "title": "short actionable title",
      "description": "precise description: what to do, why, acceptance criteria",
      "priority": "high|medium|low",
      "estimate": "e.g. 30min, 1h, 2h",
      "affectedFiles": "comma-separated list of files to create/modify"
    }
  ]
}`

    const raw = await generateText(prompt)

    // Parse tasks from AI output
    let parsed: Array<{
      title: string
      description: string
      priority: string
      estimate?: string
      affectedFiles?: string
    }> = []

    try {
      // Try to extract JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*"tasks"[\s\S]*\}/)
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]) as { tasks: typeof parsed }
        parsed = jsonData.tasks ?? []
      }
    } catch {
      // Fallback: try parsing the whole response
      try {
        const jsonData = JSON.parse(raw) as { tasks: typeof parsed }
        parsed = jsonData.tasks ?? []
      } catch {
        console.error('Failed to parse task JSON from AI response:', raw.slice(0, 500))
      }
    }

    // Ensure we have up to 5 tasks
    const tasksToCreate = parsed.slice(0, 5)

    // Delete existing PENDING/REJECTED tasks for this session
    await prisma.repoTask.deleteMany({
      where: {
        sessionId,
        status: { in: ['PENDING', 'REJECTED'] },
      },
    })

    // Create 5 new RepoTask records
    for (let i = 0; i < tasksToCreate.length; i++) {
      const t = tasksToCreate[i]
      await prisma.repoTask.create({
        data: {
          sessionId,
          cycle: currentCycle,
          number: i + 1,
          title: t.title ?? `Task ${i + 1}`,
          description: t.description ?? '',
          priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
          estimate: t.estimate ?? null,
          affectedFiles: t.affectedFiles ?? null,
          status: 'PENDING',
        },
      })
    }

    // Write TASKS.md to the repo
    const today = new Date().toISOString().split('T')[0]
    let tasksMd = `# Tasks — Cycle ${currentCycle}\n\n> Generated on ${today} from project context.\n\n## Convention\n\n- [ ] Pending validation\n- [✅] Approved\n- [❌] Rejected\n- [⏳] Executing\n- [✔️] Completed\n\n---\n\n`

    for (let i = 0; i < tasksToCreate.length; i++) {
      const t = tasksToCreate[i]
      tasksMd += `### Task ${i + 1} — ${t.title ?? `Task ${i + 1}`}\n\n`
      tasksMd += `**Priority**: ${t.priority ?? 'medium'}\n`
      if (t.estimate) tasksMd += `**Estimate**: ${t.estimate}\n`
      if (t.affectedFiles) tasksMd += `**Affected files**: ${t.affectedFiles}\n`
      tasksMd += `\n${t.description ?? ''}\n\n**Status**: [ ]\n\n---\n\n`
    }

    try {
      writeFileSync(path.join(repoPath, 'TASKS.md'), tasksMd, 'utf-8')
    } catch (err) {
      console.error('Failed to write TASKS.md:', err)
    }

    await prisma.repoSession.update({
      where: { id: sessionId },
      data: { contextStatus: 'READY' },
    })
  } catch (err) {
    console.error('generateCycleTasks error:', err)
    await prisma.repoSession.update({
      where: { id: sessionId },
      data: { contextStatus: 'ERROR' },
    })
  }
}

// ─── executeRepoTask ───────────────────────────────────────────────────────────

export async function executeRepoTask(taskId: string): Promise<void> {
  const task = await prisma.repoTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { session: true },
  })
  const { session } = task
  const { repoPath, contextSummary } = session

  const title = task.editedTitle ?? task.title
  const description = task.editedDescription ?? task.description
  const affectedFiles = task.affectedFiles ?? 'determine from context'

  const logs: string[] = []

  const flushLog = async () => {
    await prisma.repoTask.update({
      where: { id: taskId },
      data: { executionLog: logs.join('\n') },
    })
  }

  const log = async (line: string) => {
    logs.push(line)
    await flushLog()
  }

  try {
    await log(`Agent started — task ${task.number}: ${title}`)

    const prompt = `You are an AI developer working on the repository at: ${repoPath}

Project context:
${contextSummary ?? '(no context summary available)'}

Your task: ${title}
Description: ${description}
Files to work on: ${affectedFiles}

Use your tools to implement this task completely:
- Read existing files to understand the codebase
- Write/modify files to implement the task
- Run commands if needed (npm install, etc.)
- Make production-ready changes

Work entirely within: ${repoPath}
Do NOT run git commands. Do NOT commit. Just implement the code changes.`

    for await (const message of query({
      prompt,
      options: { permissionMode: 'bypassPermissions' },
    })) {
      if (message.type === 'assistant') {
        const typedMessage = message as { type: string; message?: { content?: Array<{ type: string; name?: string; input?: Record<string, unknown>; text?: string }> } }
        for (const block of typedMessage.message?.content ?? []) {
          if (block.type === 'tool_use' && block.name) {
            await log(`→ ${describeToolCall(block as { name: string; input: Record<string, unknown> })}`)
          }
          if ('text' in block && block.text) {
            await log(`✎ ${block.text.slice(0, 120)}`)
          }
        }
      }
    }

    await log(`✓ Agent finished`)

    // Capture diff
    let diff = ''
    try {
      diff = execSync('git diff', { cwd: repoPath, stdio: 'pipe', timeout: 30000 }).toString()
    } catch {
      diff = '(could not capture diff)'
    }

    await prisma.repoTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        executionLog: logs.join('\n'),
        diff: diff || null,
      },
    })
  } catch (err) {
    const errorMessage = (err as Error).message
    logs.push(`✗ Failed: ${errorMessage}`)
    await prisma.repoTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        executionLog: logs.join('\n'),
      },
    })
  }
}

// ─── commitRepoTask ────────────────────────────────────────────────────────────

export async function commitRepoTask(taskId: string): Promise<void> {
  const task = await prisma.repoTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { session: true },
  })
  const { session } = task
  const { repoPath } = session

  const title = task.editedTitle ?? task.title
  const description = task.editedDescription ?? task.description

  // Determine conventional commit type from title/description
  const lowerTitle = title.toLowerCase()
  let commitType = 'chore'
  if (lowerTitle.includes('fix') || lowerTitle.includes('bug') || lowerTitle.includes('error')) commitType = 'fix'
  else if (lowerTitle.includes('add') || lowerTitle.includes('implement') || lowerTitle.includes('create') || lowerTitle.includes('new')) commitType = 'feat'
  else if (lowerTitle.includes('test')) commitType = 'test'
  else if (lowerTitle.includes('refactor') || lowerTitle.includes('clean') || lowerTitle.includes('restructure')) commitType = 'refactor'
  else if (lowerTitle.includes('doc') || lowerTitle.includes('readme') || lowerTitle.includes('changelog')) commitType = 'docs'
  else if (lowerTitle.includes('feat') || lowerTitle.includes('feature')) commitType = 'feat'

  const commitMsg = `${commitType}: ${title}\n\nTask ${task.number} of cycle ${task.cycle}.\n${description}\n${task.affectedFiles ? `\nAffected files:\n${task.affectedFiles.split(',').map((f) => `- ${f.trim()}`).join('\n')}` : ''}`

  // Update CHANGELOG.md
  const changelogPath = path.join(repoPath, 'CHANGELOG.md')
  const changelogEntry = `\n### ${commitType === 'feat' ? 'Added' : commitType === 'fix' ? 'Fixed' : commitType === 'refactor' ? 'Changed' : commitType === 'docs' ? 'Changed' : 'Changed'}\n- ${title}: ${description.slice(0, 120)}\n`

  try {
    if (existsSync(changelogPath)) {
      let changelog = readFileSync(changelogPath, 'utf-8')
      if (changelog.includes('## [Unreleased]')) {
        changelog = changelog.replace('## [Unreleased]', `## [Unreleased]\n${changelogEntry}`)
      } else {
        changelog = `# Changelog\n\n## [Unreleased]\n${changelogEntry}\n` + changelog
      }
      writeFileSync(changelogPath, changelog, 'utf-8')
    } else {
      const today = new Date().toISOString().split('T')[0]
      writeFileSync(changelogPath, `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/).\n\n## [Unreleased]\n${changelogEntry}\n## [0.0.1] - ${today}\n\n- Initial release\n`, 'utf-8')
    }
  } catch (err) {
    console.error('Failed to update CHANGELOG.md:', err)
  }

  // Git add and commit
  execSync('git add -A', { cwd: repoPath, stdio: 'pipe', timeout: 60000 })
  const commitResult = execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: repoPath, stdio: 'pipe', timeout: 60000 })
  const commitOutput = commitResult.toString()

  // Extract commit hash
  let commitHash = ''
  try {
    commitHash = execSync('git rev-parse HEAD', { cwd: repoPath, stdio: 'pipe', timeout: 10000 }).toString().trim()
  } catch {
    // ignore
  }

  await prisma.repoTask.update({
    where: { id: taskId },
    data: { commitHash: commitHash || commitOutput.slice(0, 100) },
  })
}

// ─── rollbackRepoTask ──────────────────────────────────────────────────────────

export async function rollbackRepoTask(taskId: string): Promise<void> {
  const task = await prisma.repoTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { session: true },
  })
  const { session } = task

  execSync('git checkout -- .', { cwd: session.repoPath, stdio: 'pipe', timeout: 60000 })

  const currentLog = task.executionLog ?? ''
  await prisma.repoTask.update({
    where: { id: taskId },
    data: {
      status: 'FAILED',
      executionLog: currentLog + '\n↺ Rolled back',
      diff: null,
    },
  })
}

// ─── pushRepoSession ───────────────────────────────────────────────────────────

export async function pushRepoSession(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await prisma.repoSession.findUniqueOrThrow({ where: { id: sessionId } })
    const { repoPath } = session

    // Get GitHub token if available
    const tokens = await getUserTokens()

    if (tokens.githubToken && session.repoUrl) {
      // For HTTPS remotes, configure credentials
      try {
        const url = new URL(session.repoUrl)
        const authedUrl = `${url.protocol}//${tokens.githubToken}@${url.host}${url.pathname}`
        execSync(`git remote set-url origin ${authedUrl}`, { cwd: repoPath, stdio: 'pipe', timeout: 10000 })
      } catch {
        // ignore if URL parsing fails
      }
    }

    execSync('git push', { cwd: repoPath, stdio: 'pipe', timeout: 60000 })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
