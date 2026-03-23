import 'server-only'

export interface GithubContext {
  owner: string
  repo: string
  description: string | null
  topics: string[]
  language: string | null
  stars: number
  defaultBranch: string
  readme: string | null
  fileTree: string[]
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com') return null
    const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/')
    if (parts.length < 2 || !parts[0] || !parts[1]) return null
    return { owner: parts[0], repo: parts[1] }
  } catch {
    return null
  }
}

export async function fetchGithubContext(repoUrl: string): Promise<GithubContext | null> {
  const parsed = parseGithubUrl(repoUrl)
  if (!parsed) return null

  const { owner, repo } = parsed
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const [repoRes, readmeRes, treeRes] = await Promise.allSettled([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`, { headers }),
  ])

  if (repoRes.status !== 'fulfilled' || !repoRes.value.ok) return null

  const repoData = await repoRes.value.json()

  // README
  let readme: string | null = null
  if (readmeRes.status === 'fulfilled' && readmeRes.value.ok) {
    const readmeData = await readmeRes.value.json()
    if (readmeData.content) {
      const decoded = Buffer.from(readmeData.content, 'base64').toString('utf-8')
      readme = decoded.slice(0, 4000)
    }
  }

  // Root file tree
  let fileTree: string[] = []
  if (treeRes.status === 'fulfilled' && treeRes.value.ok) {
    const treeData = await treeRes.value.json()
    if (Array.isArray(treeData)) {
      fileTree = treeData.map((f: { name: string; type: string }) =>
        f.type === 'dir' ? `${f.name}/` : f.name
      )
    }
  }

  return {
    owner,
    repo,
    description: repoData.description ?? null,
    topics: repoData.topics ?? [],
    language: repoData.language ?? null,
    stars: repoData.stargazers_count ?? 0,
    defaultBranch: repoData.default_branch ?? 'main',
    readme,
    fileTree,
  }
}

/**
 * Push or update a file in a GitHub repository.
 * Requires a personal access token with `repo` scope (GITHUB_TOKEN env var).
 */
export async function pushFileToGithub(opts: {
  repoUrl: string
  filePath: string
  content: string
  message: string
  branch?: string
  token?: string | null
}): Promise<{ url: string } | null> {
  const token = opts.token ?? process.env.GITHUB_TOKEN
  if (!token) {
    console.log('[github] no token configured — skipping push')
    return null
  }

  const parsed = parseGithubUrl(opts.repoUrl)
  if (!parsed) return null
  const { owner, repo } = parsed
  const branch = opts.branch ?? 'main'

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'CAIO',
  }

  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${opts.filePath}`

  // Check if file already exists (need its SHA to update)
  let existingSha: string | undefined
  const checkRes = await fetch(`${apiBase}?ref=${branch}`, { headers })
  if (checkRes.ok) {
    const existing = await checkRes.json()
    existingSha = existing.sha
  }

  const putRes = await fetch(apiBase, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: opts.message,
      content: Buffer.from(opts.content, 'utf-8').toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  })

  if (!putRes.ok) {
    console.error('[github] push failed', putRes.status, await putRes.text())
    return null
  }

  const data = await putRes.json()
  return { url: data.content?.html_url ?? `https://github.com/${owner}/${repo}/blob/${branch}/${opts.filePath}` }
}

export function formatGithubContextForPrompt(ctx: GithubContext): string {
  const lines: string[] = [
    `GitHub Repository: ${ctx.owner}/${ctx.repo}`,
    ctx.description ? `Description: ${ctx.description}` : '',
    ctx.language ? `Primary language: ${ctx.language}` : '',
    ctx.topics.length ? `Topics: ${ctx.topics.join(', ')}` : '',
    ctx.fileTree.length ? `Root files:\n${ctx.fileTree.join('\n')}` : '',
    ctx.readme ? `\nREADME:\n${ctx.readme}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}
