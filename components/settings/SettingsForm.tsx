'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, CheckCircle, Circle } from 'lucide-react'

interface InitialSettings {
  vercelToken: string | null
  vercelTeamId: string
  githubToken: string | null
  configured: { vercel: boolean; github: boolean }
}

interface SettingsFormProps {
  initial: InitialSettings
}

const sectionStyle = {
  border: '1px solid var(--caio-border)',
  borderRadius: 8,
  padding: '20px 24px',
  marginBottom: 16,
  background: 'rgba(255,255,255,0.02)',
}

const labelStyle = {
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 10,
  color: 'var(--caio-text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  display: 'block',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 5,
  padding: '8px 12px',
  color: 'var(--caio-text)',
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 12,
  outline: 'none',
}

const hintStyle = {
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 10,
  color: 'var(--caio-text-dim)',
  marginTop: 5,
  lineHeight: 1.5,
}

function StatusDot({ on }: { on: boolean }) {
  return on
    ? <CheckCircle className="w-3.5 h-3.5" style={{ color: '#6EC8A9' }} />
    : <Circle className="w-3.5 h-3.5" style={{ color: 'var(--caio-text-dim)' }} />
}

function TokenField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Enter token…'}
          style={{ ...inputStyle, paddingRight: 36 }}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--caio-text-muted)',
            padding: 0,
            display: 'flex',
          }}
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p style={hintStyle}>{hint}</p>
    </div>
  )
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const [vercelToken,  setVercelToken]  = useState('')
  const [vercelTeamId, setVercelTeamId] = useState(initial.vercelTeamId)
  const [githubToken,  setGithubToken]  = useState('')
  const [saving, setSaving] = useState(false)
  const [configured, setConfigured] = useState(initial.configured)

  const handleSave = async () => {
    setSaving(true)
    try {
      const patch: Record<string, string> = {}
      if (vercelToken)  patch.vercelToken  = vercelToken
      if (vercelTeamId !== initial.vercelTeamId) patch.vercelTeamId = vercelTeamId
      if (githubToken)  patch.githubToken  = githubToken

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) { toast.error('Failed to save settings'); return }

      // Update configured state
      setConfigured({
        vercel: !!(vercelToken || initial.configured.vercel),
        github: !!(githubToken || initial.configured.github),
      })
      // Clear sensitive inputs after save
      setVercelToken('')
      setGithubToken('')
      toast.success('Settings saved')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Vercel */}
      <div style={sectionStyle}>
        <div className="flex items-center gap-2 mb-4">
          <StatusDot on={configured.vercel} />
          <span
            className="font-mono text-xs font-semibold"
            style={{ color: 'var(--caio-text)' }}
          >
            Vercel
          </span>
          <span className="font-mono text-[10px]" style={{ color: 'var(--caio-text-dim)' }}>
            — deploy landing pages
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <TokenField
            label="API Token"
            hint={
              configured.vercel
                ? `Currently configured (${initial.vercelToken}). Enter a new token to replace it.`
                : 'Create one at vercel.com/account/tokens'
            }
            value={vercelToken}
            onChange={setVercelToken}
            placeholder={configured.vercel ? '(unchanged)' : 'vrl_…'}
          />
          <div>
            <label style={labelStyle}>Team ID <span style={{ color: 'var(--caio-text-dim)', textTransform: 'none' }}>(optional)</span></label>
            <input
              type="text"
              value={vercelTeamId}
              onChange={(e) => setVercelTeamId(e.target.value)}
              placeholder="team_…"
              style={inputStyle}
              spellCheck={false}
            />
            <p style={hintStyle}>Only needed if your token belongs to a Vercel team account.</p>
          </div>
        </div>
      </div>

      {/* GitHub */}
      <div style={sectionStyle}>
        <div className="flex items-center gap-2 mb-4">
          <StatusDot on={configured.github} />
          <span
            className="font-mono text-xs font-semibold"
            style={{ color: 'var(--caio-text)' }}
          >
            GitHub
          </span>
          <span className="font-mono text-[10px]" style={{ color: 'var(--caio-text-dim)' }}>
            — push generated code to repos
          </span>
        </div>

        <TokenField
          label="Personal Access Token"
          hint={
            configured.github
              ? `Currently configured (${initial.githubToken}). Enter a new token to replace it.`
              : 'Create a classic token at github.com/settings/tokens/new — check the "repo" scope. Fine-grained tokens cannot create repositories.'
          }
          value={githubToken}
          onChange={setGithubToken}
          placeholder={configured.github ? '(unchanged)' : 'ghp_…'}
        />
      </div>

      {/* Save */}
      <div className="flex justify-end mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--caio-gold)',
            color: '#0F0F1A',
            border: 'none',
            borderRadius: 5,
            padding: '8px 20px',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  )
}
