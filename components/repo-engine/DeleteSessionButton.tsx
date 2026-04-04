'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function DeleteSessionButton({ sessionId, sessionName }: { sessionId: string; sessionName: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleting(true)
    try {
      const res = await fetch(`/api/repo-engine/${sessionId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to delete session')
        return
      }
      toast.success('Session deleted.')
      router.refresh()
    } catch {
      toast.error('Network error.')
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  const stopPropagation = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={stopPropagation}>
        <span className="font-mono text-[10px]" style={{ color: 'var(--caio-text-muted)' }}>
          Delete &ldquo;{sessionName}&rdquo;?
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            background: '#C86E6E',
            color: '#fff',
            border: 'none',
            borderRadius: 5,
            padding: '5px 12px',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 11,
            fontWeight: 700,
            cursor: deleting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Confirm
        </button>
        <button
          onClick={(e) => { stopPropagation(e); setConfirming(false) }}
          disabled={deleting}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--caio-text-dim)',
            borderRadius: 5,
            padding: '5px 10px',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { stopPropagation(e); setConfirming(true) }}
      style={{
        background: 'transparent',
        border: '1px solid rgba(200,110,110,0.3)',
        color: '#C86E6E',
        borderRadius: 5,
        padding: '4px 10px',
        fontFamily: 'var(--font-jetbrains)',
        fontSize: 10,
        cursor: 'pointer',
      }}
    >
      ✕ Delete
    </button>
  )
}
