import 'server-only'
import { createHash } from 'crypto'

/**
 * Deploy a single-file HTML landing page to Vercel.
 * Requires VERCEL_TOKEN env var. Optionally VERCEL_TEAM_ID.
 * Returns the deployed URL, or null if skipped / failed.
 */
export async function deployLandingPage(
  html: string,
  slug: string,
  token?: string | null,
): Promise<string | null> {
  const tok = token ?? process.env.VERCEL_TOKEN
  if (!tok) {
    console.log('[vercel] no token configured — skipping deployment')
    return null
  }

  const content = Buffer.from(html, 'utf-8')
  const sha1 = createHash('sha1').update(content).digest('hex')
  const size = content.length
  // Vercel project names: lowercase alphanumeric + hyphens, max 52 chars
  const projectName = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 52)

  const authHeader = { Authorization: `Bearer ${tok}` }
  const teamId = process.env.VERCEL_TEAM_ID
  const teamQ = teamId ? `?teamId=${teamId}` : ''

  // Step 1 — upload file blob (idempotent by SHA)
  const uploadRes = await fetch('https://api.vercel.com/v2/files', {
    method: 'POST',
    headers: {
      ...authHeader,
      'Content-Length': String(size),
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': sha1,
    },
    body: content,
  })

  // 200 = uploaded OK, 409 = already exists — both are fine
  if (!uploadRes.ok && uploadRes.status !== 409) {
    console.error('[vercel] file upload failed', uploadRes.status, await uploadRes.text())
    return null
  }

  // Step 2 — create deployment
  const deployRes = await fetch(`https://api.vercel.com/v13/deployments${teamQ}`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: projectName,
      files: [{ file: 'index.html', sha: sha1, size }],
      projectSettings: { framework: null, buildCommand: '', outputDirectory: '.' },
      target: 'production',
    }),
  })

  const data = await deployRes.json()
  if (!deployRes.ok) {
    console.error('[vercel] deployment failed', JSON.stringify(data))
    return null
  }

  return `https://${data.url}`
}
