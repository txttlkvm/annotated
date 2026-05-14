'use client'
import { Card } from '@/types/overlay'

interface CynicCardProps {
  card: Card
  isInline?: boolean
  onReact?: (id: string, type: 'agree' | 'question' | 'comment') => void
  isPulsing?: boolean
  cardNumber?: number
  isCollapsed?: boolean
  isPinned?: boolean
  onTogglePin?: (cardId: string) => void
  onHoverChange?: (cardId: string, hovered: boolean) => void
}

export function CynicCard({
  card, isInline, onReact, isPulsing, cardNumber,
  isCollapsed, isPinned, onTogglePin, onHoverChange,
}: CynicCardProps) {
  const badgeLabel = card.fallacyLabel ?? 'FRAMING'

  if (isCollapsed) {
    const snippet = (card.comment || card.fallacyLabel || '').slice(0, 60)
    return (
      <div
        onClick={() => onTogglePin?.(card.id)}
        onMouseEnter={() => onHoverChange?.(card.id, true)}
        onMouseLeave={() => onHoverChange?.(card.id, false)}
        className={`glass-card${isPulsing ? ' card-pulse' : ''}`}
        style={{
          borderLeft: '2.5px solid var(--cy1)',
          margin: isInline ? 'var(--sp1) 0' : '0',
          padding: '4px 8px',
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer', minHeight: 26,
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color: 'var(--t2)', opacity: 0.78,
          transition: 'opacity .12s, padding .12s',
        }}
        title="Click to expand"
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 3, background: 'var(--cy1)', color: '#fff',
          fontSize: 10, fontWeight: 700,
        }}>{cardNumber ?? ''}</span>
        <span style={{
          color: 'var(--cy1)',
          padding: '1px 5px', borderRadius: 'var(--r1)',
          fontWeight: 600, letterSpacing: '.08em', fontSize: 9,
        }}>CYNIC</span>
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: 'var(--t1)', opacity: 0.7,
        }}>{snippet}</span>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => onHoverChange?.(card.id, true)}
      onMouseLeave={() => onHoverChange?.(card.id, false)}
      onClick={isPinned && onTogglePin ? () => onTogglePin(card.id) : undefined}
      className={`glass-card card-entrance${isPulsing ? ' card-pulse' : ''}`}
      style={{
        borderLeft: '2.5px solid var(--cy1)',
        margin: isInline ? 'var(--sp2) 0 var(--sp2) 0' : '0',
        padding: 'var(--sp3)',
        position: 'relative',
        cursor: isPinned && onTogglePin ? 'pointer' : 'default',
      }}
    >
      {isPinned && onTogglePin && (
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(card.id) }}
          className="interactive"
          title="Collapse (unpin)"
          style={{
            position: 'absolute', top: 6, right: 6,
            width: 18, height: 18, lineHeight: '14px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 3, cursor: 'pointer',
            color: 'var(--t3)', fontSize: 10,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
      )}
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp2)',
        marginBottom: 'var(--sp2)',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 18, height: 18, padding: '0 5px',
          borderRadius: 4,
          fontFamily: 'var(--f-mono)', fontSize: 11,
          color: '#fff', fontWeight: 700, letterSpacing: 0,
          background: 'var(--cy1)',
        }}>{cardNumber ?? ''}</span>
        <span style={{
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color: 'var(--t2)', letterSpacing: '.06em', flex: 1,
        }}>CYNIC</span>
        <span style={{
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color: 'var(--t3)',
        }}>{card.elapsed}</span>
        <button
          className="interactive"
          title="Share on X"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--t3)', fontSize: 11, padding: '1px 3px',
          }}>↗𝕏</button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--b2)', marginBottom: 'var(--sp2)' }} />

      {/* Fallacy badge */}
      <div style={{
        display: 'inline-block',
        fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
        fontWeight: 600, letterSpacing: '.08em',
        color: 'var(--cy1)', background: 'var(--cy2)',
        padding: '2px 6px', borderRadius: 'var(--r1)',
        marginBottom: 'var(--sp2)',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {badgeLabel}
      </div>

      {/* Punch line */}
      <p style={{
        fontFamily: 'var(--f-sans)', fontSize: 'var(--fs-md)',
        color: 'var(--t1)', margin: '0 0 var(--sp2) 0',
        lineHeight: 1.5, fontStyle: 'italic',
      }}>
        {card.comment}
      </p>

      {/* Counter / opposing view */}
      {card.counter && (
        <p style={{
          fontFamily: 'var(--f-sans)', fontSize: 'var(--fs-sm)',
          color: 'var(--t2)', margin: '0 0 var(--sp2) 0',
          lineHeight: 1.5,
          borderLeft: '2px solid var(--cy2)',
          paddingLeft: 'var(--sp2)',
        }}>
          {card.counter}
        </p>
      )}

      {/* Reactions — track livestream reactions and comments */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp3)' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onReact?.(card.id, "agree") }}
          className="interactive"
          title="Agreed — fallacy nailed"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
            color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <span style={{ fontSize: '1.5em', lineHeight: 1 }}>💯</span>{card.reactionsAgree > 0 ? ` · ${card.reactionsAgree}` : ''}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onReact?.(card.id, "question") }}
          className="interactive"
          title="Not sure about this one"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
            color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <span style={{ fontSize: '1.5em', lineHeight: 1 }}>🤔</span>{card.reactionsQuestion > 0 ? ` · ${card.reactionsQuestion}` : ''}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onReact?.(card.id, "comment") }}
          className="interactive"
          title="Livestream comments on this take"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
            color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <span style={{ fontSize: '1.5em', lineHeight: 1 }}>💬</span>{(card.reactionsComment ?? 0) > 0 ? ` · ${card.reactionsComment}` : ''}
        </button>
      </div>
    </div>
  )
}
