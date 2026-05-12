'use client'
import { useState, useRef } from 'react'

interface ClaimInputProps {
  onFileClaim: (text: string) => Promise<void>
}

export function ClaimInput({ onFileClaim }: ClaimInputProps) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    const text = value.trim()
    if (!text || loading) return
    setLoading(true)
    setValue('')
    try {
      await onFileClaim(text)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit()
    if (e.key === 'Escape') setValue('')
  }

  return (
    <div style={{
      padding: 'var(--sp2) var(--sp3)',
      borderTop: '1px solid var(--b2)',
      background: 'rgba(0,0,0,0.3)',
      display: 'flex',
      gap: 'var(--sp2)',
      alignItems: 'center',
    }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="File a claim…"
        disabled={loading}
        style={{
          flex: 1,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 'var(--r2)',
          padding: '4px 8px',
          fontFamily: 'var(--f-sans)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--t1)',
          outline: 'none',
          minWidth: 0,
        }}
      />
      <button
        onClick={submit}
        disabled={!value.trim() || loading}
        className="interactive"
        style={{
          background: loading ? 'transparent' : 'var(--a4)',
          border: '1px solid var(--a1)',
          borderRadius: 'var(--r2)',
          cursor: value.trim() && !loading ? 'pointer' : 'default',
          fontFamily: 'var(--f-mono)',
          fontSize: 'var(--fs-xs)',
          color: value.trim() && !loading ? 'var(--a1)' : 'var(--t3)',
          padding: '3px 8px',
          letterSpacing: '.06em',
          whiteSpace: 'nowrap',
          opacity: value.trim() && !loading ? 1 : 0.5,
          transition: 'opacity 0.15s',
        }}>
        {loading ? '…' : '◆ CHECK'}
      </button>
    </div>
  )
}
