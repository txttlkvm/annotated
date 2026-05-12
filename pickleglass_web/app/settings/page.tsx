'use client'

export default function SettingsPage() {
  const handleClose = () => {
    // Navigate back to the overlay in the same window
    window.location.href = '/overlay'
  }

  return (
    <div style={{
      fontFamily: 'var(--f-sans, system-ui)',
      background: 'rgba(18,18,22,0.97)',
      minHeight: '100vh',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        gap: 10,
      }}>
        <button
          onClick={handleClose}
          title="Back to overlay"
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            fontSize: 16,
            lineHeight: 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          ←
        </button>
        <span style={{
          fontFamily: 'var(--f-mono, monospace)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '.10em',
          color: 'rgba(255,255,255,0.90)',
        }}>
          ANNOTATED SETTINGS
        </span>
      </div>

      {/* Body — placeholder for future settings */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
        opacity: 0.35,
      }}>
        <span style={{ fontSize: 28 }}>⚙</span>
        <span style={{ fontFamily: 'var(--f-mono, monospace)', fontSize: 11, letterSpacing: '.08em' }}>
          NO SETTINGS YET
        </span>
      </div>
    </div>
  )
}
