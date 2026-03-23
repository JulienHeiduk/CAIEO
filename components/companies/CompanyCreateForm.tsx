'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function CompanyCreateForm() {
  const router = useRouter()
  const [ideaPrompt, setIdeaPrompt] = useState('')
  const [githubRepoUrl, setGithubRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const ok = ideaPrompt.trim().length >= 10

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok) {
      toast.error('Please describe your idea in at least 10 characters.')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, string> = { ideaPrompt: ideaPrompt.trim() }
      if (githubRepoUrl.trim()) body.githubRepoUrl = githubRepoUrl.trim()

      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create company')
        return
      }

      toast.success('Company created! AI is generating your strategy...')
      router.push(`/companies/${data.company.id}`)
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Idea input */}
      <div>
        <label
          htmlFor="idea"
          className="font-mono text-[10px] block mb-2"
          style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          Idea / Spec
        </label>
        <Textarea
          id="idea"
          value={ideaPrompt}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIdeaPrompt(e.target.value)}
          placeholder="Describe the problem, target market, constraints... The more specific, the better CAIO can act."
          rows={6}
          maxLength={2000}
          disabled={loading}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: 'var(--caio-text)',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 13,
            resize: 'vertical',
            width: '100%',
          }}
        />
        <div
          className="font-mono text-[9px] text-right mt-1"
          style={{ color: 'var(--caio-text-dim)' }}
        >
          {ideaPrompt.length}/2000
        </div>
      </div>

      {/* GitHub repo (optional) */}
      <div>
        <label
          htmlFor="github"
          className="font-mono text-[10px] block mb-2"
          style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          GitHub Repository <span style={{ color: 'var(--caio-text-dim)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <input
          id="github"
          type="url"
          value={githubRepoUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGithubRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          disabled={loading}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: 'var(--caio-text)',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 12,
            padding: '10px 12px',
            width: '100%',
            outline: 'none',
          }}
        />
        <p className="font-mono text-[9px] mt-1" style={{ color: 'var(--caio-text-dim)' }}>
          CAIO will read the README and file structure to use as context.
        </p>
      </div>

      {/* What happens next */}
      <div
        className="rounded-lg p-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className="font-mono text-[9px] mb-3"
          style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          What happens next
        </div>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            'AI generates a company name and brand identity',
            'AI creates a detailed growth strategy',
            'Daily tasks are generated for your approval',
            'You review and approve before anything goes live',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 font-mono text-xs" style={{ color: 'var(--caio-text-secondary)' }}>
              <span style={{ color: 'var(--caio-gold)', flexShrink: 0 }}>→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !ok}
        style={{
          background: ok && !loading ? 'var(--caio-gold)' : 'rgba(255,255,255,0.06)',
          color: ok && !loading ? '#0F0F1A' : 'var(--caio-text-dim)',
          border: 'none',
          borderRadius: 6,
          padding: '13px',
          fontFamily: 'var(--font-jetbrains)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.05em',
          cursor: ok && !loading ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
        }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating your company...
          </>
        ) : (
          'LAUNCH COMPANY →'
        )}
      </button>
    </form>
  )
}
