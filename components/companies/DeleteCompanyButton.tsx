'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function DeleteCompanyButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/companies/${companyId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to delete')
        return
      }
      toast.success('Company deleted.')
      router.push('/dashboard')
    } catch {
      toast.error('Network error.')
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="font-mono text-[10px]" style={{ color: 'var(--caio-text-muted)' }}>
          Delete &ldquo;{companyName}&rdquo;?
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
          onClick={() => setConfirming(false)}
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
      onClick={() => setConfirming(true)}
      style={{
        background: 'transparent',
        border: '1px solid rgba(200,110,110,0.3)',
        color: '#C86E6E',
        borderRadius: 5,
        padding: '6px 12px',
        fontFamily: 'var(--font-jetbrains)',
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      ✕ Delete
    </button>
  )
}
