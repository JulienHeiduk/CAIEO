'use client'

import ReactMarkdown from 'react-markdown'

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="font-heading text-xl font-bold mb-3 mt-5" style={{ color: 'var(--caio-text)' }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-heading text-lg font-bold mb-2 mt-4" style={{ color: 'var(--caio-text)' }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-mono text-sm font-bold mb-2 mt-3" style={{ color: 'var(--caio-gold)' }}>{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm mb-3" style={{ color: 'var(--caio-text-secondary)', lineHeight: 1.8 }}>{children}</p>
          ),
          strong: ({ children }) => (
            <strong style={{ color: 'var(--caio-text)', fontWeight: 700 }}>{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 pl-4" style={{ color: 'var(--caio-text-secondary)' }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 pl-4" style={{ color: 'var(--caio-text-secondary)' }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm mb-1" style={{ lineHeight: 1.7 }}>{children}</li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="w-full font-mono text-xs" style={{ borderCollapse: 'collapse' }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2" style={{ color: 'var(--caio-gold)', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 700, letterSpacing: '0.04em' }}>{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-xs" style={{ color: 'var(--caio-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{children}</td>
          ),
          hr: () => (
            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '16px 0' }} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
