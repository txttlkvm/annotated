'use client'
import { TickMark } from '@/types/overlay'

interface TickTooltipProps {
  tick: TickMark
}

export function TickTooltip({ tick }: TickTooltipProps) {
  const color = tick.type === 'fc' ? 'var(--fc1)'
    : tick.type === 'cynic' ? 'var(--cy1)'
    : 'var(--a1)'

  const label = tick.type === 'fc' ? 'FC'
    : tick.type === 'cynic' ? 'CY'
    : '⌘'

  return (
    <div className="glass-card" style={{
      // Wrapper in TickRail handles outer positioning; we just render content.
      width: 240,
      padding: 'var(--sp3)',
      zIndex: 100,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp2)',
        marginBottom: 'var(--sp2)',
      }}>
        <span style={{
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color, fontWeight: 600,
        }}>{tick.elapsed}</span>
        <span style={{ height: 1, width: 1, background: 'var(--b2)' }} />
        <span style={{
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color, letterSpacing: '.08em',
        }}>{label}</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--b2)', marginBottom: 'var(--sp2)' }} />

      {/* Comment excerpt */}
      <p style={{
        fontFamily: 'var(--f-sans)', fontSize: 'var(--fs-sm)',
        color: 'var(--t1)', margin: '0 0 var(--sp2) 0',
        lineHeight: 1.5,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      } as React.CSSProperties}>
        &ldquo;{tick.comment}&rdquo;
      </p>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--b2)', marginBottom: 'var(--sp2)' }} />

      {/* Trigger */}
      <div style={{
        fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
        color: 'var(--t3)', marginBottom: 2,
        letterSpacing: '.04em',
      }}>Trigger:</div>
      <p style={{
        fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
        color: 'var(--t2)', margin: 0, lineHeight: 1.4,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      } as React.CSSProperties}>
        &ldquo;{tick.triggerSentence}&rdquo;
      </p>
    </div>
  )
}
