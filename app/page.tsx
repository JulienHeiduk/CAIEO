import Link from 'next/link'

const goldBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'var(--caio-gold)',
  color: '#0F0F1A',
  border: 'none',
  borderRadius: 6,
  padding: '12px 28px',
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textDecoration: 'none',
} as const

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--caio-bg)', color: 'var(--caio-text)' }}
    >
      <div className="max-w-3xl mx-auto text-center" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        {/* Brand */}
        <div>
          <div
            className="font-mono text-xs mb-4"
            style={{ color: 'var(--caio-text-muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}
          >
            Chief AI Intelligence Officer
          </div>
          <h1
            className="font-heading"
            style={{ fontSize: 'clamp(52px, 8vw, 88px)', color: 'var(--caio-text)', fontWeight: 700, lineHeight: 1.05, marginBottom: 24 }}
          >
            Your companies,<br />
            <span style={{ color: 'var(--caio-gold)' }}>run by AI.</span>
          </h1>
          <p
            className="font-mono text-sm mx-auto"
            style={{ color: 'var(--caio-text-secondary)', lineHeight: 1.8, maxWidth: 540 }}
          >
            Submit an idea. CAIO generates strategy, engineering, marketing,
            outreach, and ops tasks daily — and executes them autonomously.
            You approve before anything goes live.
          </p>
        </div>

        {/* CTA */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/dashboard" style={goldBtn}>
            Get Started →
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            { icon: '◈', title: 'Autonomous execution', desc: 'CAIO generates and executes daily tasks across all channels.' },
            { icon: '⚑', title: 'Human approval gate', desc: 'Review every action before it goes live. Full control.' },
            { icon: '⬡', title: 'Portfolio view', desc: 'Manage multiple AI-powered companies from one dashboard.' },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-lg p-5 text-left"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="font-mono text-lg mb-3" style={{ color: 'var(--caio-gold)' }}>{f.icon}</div>
              <div className="font-heading text-base mb-2" style={{ color: 'var(--caio-text)', fontWeight: 700 }}>{f.title}</div>
              <div className="font-mono text-xs" style={{ color: 'var(--caio-text-muted)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
