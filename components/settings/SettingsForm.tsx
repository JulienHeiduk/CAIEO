'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, CheckCircle, Circle } from 'lucide-react'

type Configured = Record<string, boolean>

interface InitialSettings {
  configured: Configured
  [key: string]: string | null | Configured
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
    ? <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#6EC8A9' }} />
    : <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--caio-text-dim)' }} />
}

function TokenField({ label, hint, value, onChange, placeholder, isSecret = true }: {
  label: string; hint: string; value: string; onChange: (v: string) => void; placeholder?: string; isSecret?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={isSecret && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Enter value…'}
          style={{ ...inputStyle, paddingRight: isSecret ? 36 : 12 }}
          autoComplete="off"
          spellCheck={false}
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--caio-text-muted)', padding: 0, display: 'flex',
            }}
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      <p style={hintStyle}>{hint}</p>
    </div>
  )
}

interface SectionDef {
  id: string
  title: string
  desc: string
  fields: { key: string; label: string; hint: string; placeholder?: string; isSecret?: boolean }[]
  configKey: string // which field in configured to check
}

const SECTIONS: SectionDef[] = [
  {
    id: 'vercel', title: 'Vercel', desc: 'deploy frontends & landing pages', configKey: 'vercelToken',
    fields: [
      { key: 'vercelToken', label: 'API Token', hint: 'vercel.com/account/tokens', placeholder: 'vrl_…' },
      { key: 'vercelTeamId', label: 'Team ID (optional)', hint: 'Only for team accounts', placeholder: 'team_…', isSecret: false },
    ],
  },
  {
    id: 'github', title: 'GitHub', desc: 'repos, code push, bootstrap', configKey: 'githubToken',
    fields: [
      { key: 'githubToken', label: 'Personal Access Token', hint: 'github.com/settings/tokens/new — check "repo" scope (classic token)', placeholder: 'ghp_…' },
    ],
  },
  {
    id: 'supabase', title: 'Supabase', desc: 'database, auth, storage, edge functions', configKey: 'supabaseToken',
    fields: [
      { key: 'supabaseToken', label: 'Management API Token', hint: 'supabase.com/dashboard/account/tokens', placeholder: 'sbp_…' },
      { key: 'supabaseOrgId', label: 'Organization ID', hint: 'supabase.com/dashboard → Org Settings', placeholder: 'org-…', isSecret: false },
    ],
  },
  {
    id: 'stripe', title: 'Stripe', desc: 'payments, subscriptions, checkout', configKey: 'stripeSecretKey',
    fields: [
      { key: 'stripeSecretKey', label: 'Secret Key', hint: 'dashboard.stripe.com/apikeys — use test key first (sk_test_…)', placeholder: 'sk_…' },
    ],
  },
  {
    id: 'resend', title: 'Resend', desc: 'transactional emails', configKey: 'resendApiKey',
    fields: [
      { key: 'resendApiKey', label: 'API Key', hint: 'resend.com/api-keys', placeholder: 're_…' },
    ],
  },
  {
    id: 'clerk', title: 'Clerk', desc: 'authentication & user management', configKey: 'clerkSecretKey',
    fields: [
      { key: 'clerkSecretKey', label: 'Secret Key', hint: 'dashboard.clerk.com → API Keys', placeholder: 'sk_…' },
    ],
  },
  {
    id: 'posthog', title: 'PostHog', desc: 'product analytics', configKey: 'posthogApiKey',
    fields: [
      { key: 'posthogApiKey', label: 'Project API Key', hint: 'app.posthog.com → Project Settings', placeholder: 'phc_…' },
      { key: 'posthogHost', label: 'Host (optional)', hint: 'Default: https://app.posthog.com', placeholder: 'https://app.posthog.com', isSecret: false },
    ],
  },
  {
    id: 'sentry', title: 'Sentry', desc: 'error tracking & monitoring', configKey: 'sentryAuthToken',
    fields: [
      { key: 'sentryAuthToken', label: 'Auth Token', hint: 'sentry.io/settings/auth-tokens', placeholder: 'sntrys_…' },
      { key: 'sentryOrg', label: 'Organization Slug', hint: 'sentry.io/settings → General', placeholder: 'my-org', isSecret: false },
    ],
  },
  {
    id: 'pinecone', title: 'Pinecone', desc: 'vector database for AI/RAG', configKey: 'pineconeApiKey',
    fields: [
      { key: 'pineconeApiKey', label: 'API Key', hint: 'app.pinecone.io → API Keys', placeholder: 'pcsk_…' },
    ],
  },
  {
    id: 'linkedin', title: 'LinkedIn', desc: 'auto-publish posts', configKey: 'linkedinToken',
    fields: [
      { key: 'linkedinToken', label: 'Access Token', hint: 'linkedin.com/developers → create app → OAuth 2.0 → generate token with w_member_social scope' },
    ],
  },
  {
    id: 'twitter', title: 'Twitter / X', desc: 'auto-publish tweets', configKey: 'twitterApiKey',
    fields: [
      { key: 'twitterApiKey', label: 'API Key', hint: 'developer.x.com → app → Keys and tokens', placeholder: '' },
      { key: 'twitterApiSecret', label: 'API Secret', hint: '' },
      { key: 'twitterAccessToken', label: 'Access Token', hint: 'Generated with read+write permissions' },
      { key: 'twitterAccessSecret', label: 'Access Token Secret', hint: '' },
    ],
  },
  {
    id: 'reddit', title: 'Reddit', desc: 'auto-publish posts', configKey: 'redditClientId',
    fields: [
      { key: 'redditClientId', label: 'Client ID', hint: 'reddit.com/prefs/apps → create "script" app', isSecret: false },
      { key: 'redditClientSecret', label: 'Client Secret', hint: '' },
      { key: 'redditUsername', label: 'Username', hint: 'Reddit account username', isSecret: false },
      { key: 'redditPassword', label: 'Password', hint: 'Reddit account password' },
    ],
  },
]

export function SettingsForm({ initial }: { initial: InitialSettings }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [configured, setConfigured] = useState<Configured>(initial.configured)

  const setValue = (key: string, val: string) => setValues((prev) => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      // Only send fields that have been filled in
      const patch: Record<string, string> = {}
      for (const [key, val] of Object.entries(values)) {
        if (val) patch[key] = val
      }

      if (Object.keys(patch).length === 0) {
        toast.error('Nothing to save')
        setSaving(false)
        return
      }

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) { toast.error('Failed to save'); return }

      // Update configured state
      const newConfigured = { ...configured }
      for (const key of Object.keys(patch)) {
        newConfigured[key] = true
      }
      setConfigured(newConfigured)
      setValues({})
      toast.success('Settings saved')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {SECTIONS.map((section) => {
        const isConfigured = configured[section.configKey] ?? false
        return (
          <div key={section.id} style={sectionStyle}>
            <div className="flex items-center gap-2 mb-4">
              <StatusDot on={isConfigured} />
              <span className="font-mono text-xs font-semibold" style={{ color: 'var(--caio-text)' }}>
                {section.title}
              </span>
              <span className="font-mono text-[10px]" style={{ color: 'var(--caio-text-dim)' }}>
                — {section.desc}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {section.fields.map((field) => (
                <TokenField
                  key={field.key}
                  label={field.label}
                  hint={
                    configured[field.key] && !field.hint.startsWith('Only') && !field.hint.startsWith('Default')
                      ? `Configured (${initial[field.key] ?? '••••'}). Enter new value to replace.`
                      : field.hint
                  }
                  value={values[field.key] ?? ''}
                  onChange={(v) => setValue(field.key, v)}
                  placeholder={configured[field.key] ? '(unchanged)' : field.placeholder}
                  isSecret={field.isSecret !== false}
                />
              ))}
            </div>
          </div>
        )
      })}

      <div className="flex justify-end mt-2 mb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--caio-gold)', color: '#0F0F1A', border: 'none',
            borderRadius: 5, padding: '8px 20px', fontFamily: 'var(--font-jetbrains)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
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
