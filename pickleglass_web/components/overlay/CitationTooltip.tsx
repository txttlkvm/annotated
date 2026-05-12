'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CitationPassage } from '@/types/overlay'

interface CitationTooltipProps {
  passage: CitationPassage
  anchorRect: DOMRect
}

const W = 280
const GAP = 8
const MARGIN = 8 // viewport edge margin

export function CitationTooltip({ passage, anchorRect }: CitationTooltipProps) {
  // We render once invisible to measure actual height, then position.
  // This guarantees the tooltip never gets cut off by the viewport.
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const measured = ref.current.getBoundingClientRect()
    const desiredH = measured.height
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Horizontal: align left with anchor, clamp inside viewport
    let left = anchorRect.left
    if (left + W > vw - MARGIN) left = vw - W - MARGIN
    if (left < MARGIN) left = MARGIN

    // Vertical: prefer above, else below; if neither fits, pin to whichever side has more room
    const spaceAbove = anchorRect.top - GAP - MARGIN
    const spaceBelow = vh - anchorRect.bottom - GAP - MARGIN

    let top: number
    let maxHeight: number
    if (desiredH <= spaceAbove) {
      // Fits above
      top = anchorRect.top - GAP - desiredH
      maxHeight = spaceAbove
    } else if (desiredH <= spaceBelow) {
      // Fits below
      top = anchorRect.bottom + GAP
      maxHeight = spaceBelow
    } else if (spaceBelow >= spaceAbove) {
      // Pin below, scroll inside
      top = anchorRect.bottom + GAP
      maxHeight = Math.max(80, spaceBelow)
    } else {
      // Pin above, scroll inside
      maxHeight = Math.max(80, spaceAbove)
      top = anchorRect.top - GAP - maxHeight
    }

    // Final viewport clamps
    if (top < MARGIN) top = MARGIN
    if (top + Math.min(desiredH, maxHeight) > vh - MARGIN) {
      maxHeight = Math.max(80, vh - MARGIN - top)
    }

    setPos({ top, left, maxHeight })
  }, [anchorRect.left, anchorRect.top, anchorRect.right, anchorRect.bottom])

  // First render: hidden but mounted so we can measure. After measure, show with computed pos.
  const style: React.CSSProperties = {
    position: 'fixed',
    width: W,
    zIndex: 2147483647, // max — above absolutely everything
    pointerEvents: 'none',
    overflowY: 'auto',
    ...(pos
      ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight, visibility: 'visible' }
      : { top: -9999, left: -9999, visibility: 'hidden' }),
  }

  // Portal to document.body so the tooltip escapes any transformed/clipped
  // ancestor (e.g. the card's translateX hover effect, which creates a new
  // stacking context that would otherwise trap a position: fixed child).
  if (typeof document === 'undefined') return null
  return createPortal((
    <div ref={ref} className="glass-card" style={style}>
      {passage.archiveDate && (
        <div style={{
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color: 'var(--a1)', marginBottom: 'var(--sp1)',
          letterSpacing: '.06em',
          padding: 'var(--sp2) var(--sp3) 0 var(--sp3)',
        }}>
          Archived {passage.archiveDate}
        </div>
      )}
      {passage.title && (
        <div style={{
          fontFamily: 'var(--f-sans)', fontSize: 'var(--fs-sm)',
          color: 'var(--t2)', marginBottom: 'var(--sp1)',
          fontWeight: 500,
          padding: '0 var(--sp3)',
        }}>
          {passage.title}
        </div>
      )}
      <p style={{
        fontFamily: 'var(--f-sans)', fontSize: 'var(--fs-sm)',
        color: 'var(--t1)', margin: 0, lineHeight: 1.5,
        padding: 'var(--sp3)',
      }}>
        {passage.passage}
      </p>
    </div>
  ), document.body)
}
