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

/** Generate text from Claude, optionally with a specific model */
async function generateText(prompt: string, model?: string): Promise<string> {
  let output = ''
  for await (const message of query({
    prompt,
    options: { permissionMode: 'bypassPermissions', ...(model ? { model } : {}) },
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

/** Extract the tasks array from raw AI output, trying multiple strategies */
function parseTasksFromText(raw: string): Array<{
  title: string
  description: string
  priority: string
  estimate?: string
  affectedFiles?: string
}> {
  type TaskEntry = { title: string; description: string; priority: string; estimate?: string; affectedFiles?: string }

  // Strategy 1: direct parse
  try {
    const data = JSON.parse(raw) as { tasks?: TaskEntry[] }
    if (data.tasks?.length) return data.tasks
  } catch { /* continue */ }

  // Strategy 2: extract from markdown code block
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlock) {
    try {
      const data = JSON.parse(codeBlock[1]) as { tasks?: TaskEntry[] }
      if (data.tasks?.length) return data.tasks
    } catch { /* continue */ }
  }

  // Strategy 3: find all balanced JSON objects (handles preamble/postamble, respects strings)
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false
    let j = i
    for (; j < raw.length; j++) {
      const c = raw[j]
      if (escaped) { escaped = false; continue }
      if (c === '\\' && inString) { escaped = true; continue }
      if (c === '"') { inString = !inString; continue }
      if (inString) continue
      if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) break }
    }
    if (depth === 0) {
      try {
        const data = JSON.parse(raw.slice(i, j + 1)) as { tasks?: TaskEntry[] }
        if (data.tasks?.length) return data.tasks
      } catch { /* continue to next candidate */ }
    }
  }

  return []
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

export async function generateCycleTasks(sessionId: string, userContext?: string, contextFiles?: string[], taskCount = 5): Promise<void> {
  try {
    const session = await prisma.repoSession.findUniqueOrThrow({ where: { id: sessionId } })
    const { repoPath, repoName, contextSummary, currentCycle } = session

    const changelog = safeRead(path.join(repoPath, 'CHANGELOG.md'))
    const tasks = safeRead(path.join(repoPath, 'TASKS.md'))

    // All committed tasks across all cycles — the authoritative "already done" list
    const completedTasks = await prisma.repoTask.findMany({
      where: { sessionId, commitHash: { not: null } },
      orderBy: [{ cycle: 'asc' }, { number: 'asc' }],
    })

    const completedTasksList = completedTasks.length > 0
      ? completedTasks.map((t) => `- [cycle ${t.cycle}] ${t.editedTitle ?? t.title}: ${(t.editedDescription ?? t.description).slice(0, 120)}`).join('\n')
      : 'None yet.'

    // Read user-specified context files
    let extraFilesContent = ''
    for (const filename of contextFiles ?? []) {
      const filePath = path.join(repoPath, filename)
      const content = safeRead(filePath)
      if (content) {
        extraFilesContent += `\n## ${filename}\n${content.slice(0, 4000)}\n`
      }
    }

    const prompt = `You are an AI engineering lead for the project "${repoName}".

${contextSummary ? `## Project Context\n${contextSummary}\n` : ''}
${changelog ? `## Current CHANGELOG.md\n${changelog.slice(-3000)}\n` : ''}

## Already completed tasks (DO NOT repeat or duplicate any of these)
${completedTasksList}

${tasks ? `## Previous TASKS.md\n${tasks.slice(0, 2000)}\n` : ''}
${extraFilesContent}
${userContext ? `## User instructions for this cycle\n${userContext}\n` : ''}

This is cycle ${currentCycle}. Generate EXACTLY ${taskCount} actionable development tasks for this project.
IMPORTANT: The tasks listed under "Already completed tasks" are DONE — do not propose them again, even rephrased.${userContext ? ' Prioritize the user instructions above when choosing and ordering tasks.' : ''}${extraFilesContent ? ' Use the provided files as additional context to inform your task selection.' : ''}

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

    const raw = await generateText(prompt, 'claude-opus-4-6')

    // Parse tasks from AI output
    const parsed = parseTasksFromText(raw)
    if (parsed.length === 0) {
      console.error('generateCycleTasks: could not parse tasks from AI response. Raw output:\n', raw.slice(0, 800))
    }

    // Ensure we have up to taskCount tasks
    const tasksToCreate = parsed.slice(0, taskCount)

    // Only replace existing tasks if we have new ones to create
    if (tasksToCreate.length === 0) {
      console.error('generateCycleTasks: AI returned 0 tasks, aborting replace. Raw:', raw.slice(0, 300))
      await prisma.repoSession.update({
        where: { id: sessionId },
        data: { contextStatus: 'ERROR' },
      })
      return
    }

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

// ─── runCycleReview ────────────────────────────────────────────────────────────

export async function runCycleReview(sessionId: string): Promise<void> {
  const logs: string[] = []

  const flushLog = async () => {
    await prisma.repoSession.update({
      where: { id: sessionId },
      data: { reviewLog: logs.join('\n') },
    })
  }

  const log = async (line: string) => {
    logs.push(line)
    await flushLog()
  }

  try {
    await prisma.repoSession.update({
      where: { id: sessionId },
      data: { reviewStatus: 'RUNNING', reviewLog: null },
    })

    const session = await prisma.repoSession.findUniqueOrThrow({ where: { id: sessionId } })
    const { repoPath, repoName, contextSummary, currentCycle } = session

    await log(`◈ Cycle review started — cycle ${currentCycle} — model: claude-opus-4-6`)

    // Gather committed tasks for the current cycle
    const committedTasks = await prisma.repoTask.findMany({
      where: { sessionId, cycle: currentCycle, commitHash: { not: null } },
      orderBy: { number: 'asc' },
    })

    await log(`→ ${committedTasks.length} committed task(s) found for cycle ${currentCycle}`)

    // Read key repo files
    await log(`→ Reading repository files...`)
    const tree = buildDirTree(repoPath, 4)
    const changelog = safeRead(path.join(repoPath, 'CHANGELOG.md'))
    const readme = safeRead(path.join(repoPath, 'README.md'))
    const spec = safeRead(path.join(repoPath, 'SPEC.md')) ?? safeRead(path.join(repoPath, 'spec.md'))

    // Read more source files for deeper review
    const sourceFiles = findMainSourceFiles(repoPath)
    let sourceContent = ''
    for (const fp of sourceFiles) {
      const content = safeRead(fp)
      if (content) {
        sourceContent += `\n\n--- ${path.relative(repoPath, fp)} ---\n${content.slice(0, 2000)}`
      }
    }

    await log(`→ Scanning directory tree (${tree.split('\n').length} entries)`)
    if (spec) await log(`→ SPEC.md found`)
    if (readme) await log(`→ README.md found`)
    if (changelog) await log(`→ CHANGELOG.md found`)
    if (sourceFiles.length > 0) await log(`→ ${sourceFiles.length} main source file(s) loaded`)

    const tasksSummary = committedTasks.map((t, i) =>
      `${i + 1}. [${t.commitHash?.slice(0, 8)}] ${t.editedTitle ?? t.title}\n   ${(t.editedDescription ?? t.description).slice(0, 200)}`
    ).join('\n\n')

    await log(`✎ Sending context to Opus 4.6 for analysis...`)

    const prompt = `You are a senior software engineer and code reviewer. You are doing a thorough review of the project "${repoName}" after cycle ${currentCycle} of development.

## Project Context
${contextSummary ?? '(no context summary)'}

## Tasks completed this cycle
${tasksSummary || '(no committed tasks yet)'}

## Directory structure
\`\`\`
${tree}
\`\`\`

${spec ? `## SPEC.md\n${spec.slice(0, 2000)}\n` : ''}
${readme ? `## README.md\n${readme.slice(0, 1500)}\n` : ''}
${changelog ? `## CHANGELOG.md (recent)\n${changelog.slice(-2000)}\n` : ''}
${sourceContent ? `## Source files\n${sourceContent}\n` : ''}

Perform a comprehensive review covering these dimensions:

1. **Implementation quality** — Are the tasks actually implemented? Is the code production-ready? Any obvious bugs or missing edge cases?
2. **Feature completeness** — Do the implemented features match the spec/description? What's missing?
3. **Code quality** — Architecture, naming, duplication, security concerns, error handling
4. **Test coverage** — Are features tested? What critical paths lack tests?
5. **Next cycle readiness** — What are the most important things to tackle next?

Format your review as structured markdown with clear sections. Be direct and specific — name files, functions, and concrete issues. This review will be used to guide the next development cycle.`

    // Stream review with live log updates
    let reviewContent = ''
    let charCount = 0
    for await (const message of query({
      prompt,
      options: { permissionMode: 'bypassPermissions', model: 'claude-opus-4-6' },
    })) {
      if (message.type === 'assistant') {
        const typedMessage = message as { type: string; message?: { content?: Array<{ type: string; text?: string }> } }
        for (const block of typedMessage.message?.content ?? []) {
          if ('text' in block && block.text) {
            reviewContent += block.text
            charCount += block.text.length
            if (charCount % 400 < block.text.length) {
              await log(`✎ Generating… (${charCount} chars)`)
            }
          }
        }
      }
    }

    await log(`✓ Review complete (${reviewContent.length} chars)`)

    // Write REVIEW.md to the repo
    const today = new Date().toISOString().split('T')[0]
    const reviewMd = `# Code Review — Cycle ${currentCycle}\n\n> Generated on ${today} by Chief AI Officer (claude-opus-4-6)\n\n${reviewContent.trim()}\n`
    const reviewPath = path.join(repoPath, 'REVIEW.md')
    writeFileSync(reviewPath, reviewMd, 'utf-8')
    await log(`→ Write  REVIEW.md`)

    // Commit REVIEW.md
    execSync('git add REVIEW.md', { cwd: repoPath, stdio: 'pipe', timeout: 30000 })
    execSync(`git commit -m "docs: cycle ${currentCycle} code review\n\nGenerated by Chief AI Officer (claude-opus-4-6)."`, {
      cwd: repoPath, stdio: 'pipe', timeout: 30000,
    })
    const commitHash = execSync('git rev-parse HEAD', { cwd: repoPath, stdio: 'pipe', timeout: 10000 }).toString().trim()
    await log(`✓ Committed REVIEW.md (${commitHash.slice(0, 8)})`)

    // Push
    const tokens = await getUserTokens()
    if (tokens.githubToken && session.repoUrl) {
      try {
        const url = new URL(session.repoUrl)
        const authedUrl = `${url.protocol}//${tokens.githubToken}@${url.host}${url.pathname}`
        execSync(`git remote set-url origin ${authedUrl}`, { cwd: repoPath, stdio: 'pipe', timeout: 10000 })
      } catch { /* ignore URL parse errors */ }
    }
    execSync('git push', { cwd: repoPath, stdio: 'pipe', timeout: 60000 })
    await log(`✓ Pushed to remote`)

    await prisma.repoSession.update({
      where: { id: sessionId },
      data: {
        reviewContent: reviewContent.trim(),
        reviewLog: logs.join('\n'),
        reviewStatus: 'DONE',
        reviewCycle: currentCycle,
      },
    })
  } catch (err) {
    console.error('runCycleReview error:', err)
    logs.push(`✗ Failed: ${(err as Error).message}`)
    await prisma.repoSession.update({
      where: { id: sessionId },
      data: { reviewStatus: 'ERROR', reviewLog: logs.join('\n') },
    })
  }
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
