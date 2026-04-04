'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface GithubContext {
  owner: string
  repo: string
  description: string | null
  topics: string[]
  language: string | null
  stars: number
  fileTree: string[]
}

interface Props {
  companyId: string
  githubRepoUrl: string | null
  githubContext: string | null
}

export function GithubRepoSection({ companyId, githubRepoUrl, githubContext }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(githubRepoUrl ?? '')
  const [saving, setSaving] = useState(false)

  const ctx: GithubContext | null = githubContext ? JSON.parse(githubContext) : null

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubRepoUrl: url.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update')
        return
      }
      toast.success(url.trim() ? 'GitHub repo linked!' : 'GitHub repo removed.')
      setEditing(false)
      router.refresh()
    } catch {
      toast.error('Network error.')
    } finally {
      setSaving(false)
    }
  }

  const sectionStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 9,
    color: 'var(--caio-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 12,
    display: 'block',
  }

  if (!githubRepoUrl && !editing) {
    return (
      <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={labelStyle}>GitHub Repository</span>
          <p className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>
            No repository linked. Add one to give CAIO codebase context.
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--caio-text-secondary)',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 11,
            padding: '6px 14px',
            borderRadius: 5,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          + Link repo
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div style={sectionStyle}>
        <span style={labelStyle}>GitHub Repository</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            disabled={saving}
            autoFocus
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              color: 'var(--caio-text)',
              fontFamily: 'var(--font-jetbrains)',
              fontSize: 12,
              padding: '8px 12px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: 'var(--caio-gold)',
              color: '#0F0F1A',
              border: 'none',
              borderRadius: 5,
              padding: '8px 16px',
              fontFamily: 'var(--font-jetbrains)',
              fontSize: 11,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Save
          </button>
          <button
            onClick={() => { setEditing(false); setUrl(githubRepoUrl ?? '') }}
            disabled={saving}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--caio-text-dim)',
              borderRadius: 5,
              padding: '8px 12px',
              fontFamily: 'var(--font-jetbrains)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Linked state
  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: ctx ? 14 : 0 }}>
        <span style={labelStyle}>GitHub Repository</span>
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--caio-text-dim)',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 10,
            cursor: 'pointer',
            padding: '2px 6px',
          }}
        >
          ✎ change
        </button>
      </div>

      <a
        href={githubRepoUrl!}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs"
        style={{ color: 'var(--caio-gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        ⬡ {ctx ? `${ctx.owner}/${ctx.repo}` : githubRepoUrl}
      </a>

      {ctx && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ctx.description && (
            <p className="font-mono text-xs" style={{ color: 'var(--caio-text-secondary)', lineHeight: 1.6 }}>
              {ctx.description}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ctx.language && (
              <span className="font-mono text-[9px] px-2 py-0.5 rounded" style={{ background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.2)', color: 'var(--caio-gold)' }}>
                {ctx.language}
              </span>
            )}
            {ctx.stars > 0 && (
              <span className="font-mono text-[9px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--caio-text-muted)' }}>
                ★ {ctx.stars.toLocaleString()}
              </span>
            )}
            {ctx.topics.slice(0, 5).map((t) => (
              <span key={t} className="font-mono text-[9px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--caio-text-muted)' }}>
                {t}
              </span>
            ))}
          </div>
          {ctx.fileTree.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div className="font-mono text-[9px] mb-1" style={{ color: 'var(--caio-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Root files
              </div>
              <div className="font-mono text-[10px]" style={{ color: 'var(--caio-text-dim)', display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                {ctx.fileTree.slice(0, 20).map((f) => (
                  <span key={f}>{f}</span>
                ))}
                {ctx.fileTree.length > 20 && <span>+{ctx.fileTree.length - 20} more</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
