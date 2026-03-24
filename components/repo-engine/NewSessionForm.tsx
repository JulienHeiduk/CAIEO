'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function NewSessionForm() {
  const router = useRouter()
  const [repoPath, setRepoPath] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!repoPath.trim()) {
      toast.error('Please enter a local repository path')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/repo-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: repoPath.trim(), repoUrl: repoUrl.trim() || undefined }),
      })

      const data = await res.json() as { id?: string; error?: string }

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create session')
        return
      }

      toast.success('Session created — scanning repository...')
      router.push(`/repo-engine/${data.id}`)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 5,
    color: 'var(--caio-text)',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 12,
    padding: '8px 12px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 10,
    color: 'var(--caio-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 4,
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label style={labelStyle}>Local repository path *</label>
        <input
          type="text"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          placeholder="/home/user/projects/my-repo"
          style={inputStyle}
          disabled={loading}
          required
        />
        <p className="font-mono text-[10px] mt-1" style={{ color: 'var(--caio-text-dim)' }}>
          Absolute path to an existing local git repository
        </p>
      </div>

      <div>
        <label style={labelStyle}>GitHub URL (optional)</label>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          style={inputStyle}
          disabled={loading}
        />
        <p className="font-mono text-[10px] mt-1" style={{ color: 'var(--caio-text-dim)' }}>
          Used for push operations (HTTPS remote)
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !repoPath.trim()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: loading || !repoPath.trim() ? 'rgba(200,169,110,0.15)' : 'var(--caio-gold)',
          color: loading || !repoPath.trim() ? 'var(--caio-gold)' : '#0F0F1A',
          border: loading || !repoPath.trim() ? '1px solid rgba(200,169,110,0.3)' : 'none',
          borderRadius: 5,
          padding: '9px 18px',
          fontFamily: 'var(--font-jetbrains)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          cursor: loading || !repoPath.trim() ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        {loading ? 'Creating...' : '⊕ Start Task Engine'}
      </button>
    </form>
  )
}
