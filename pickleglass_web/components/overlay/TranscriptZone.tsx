'use client'
import React, { useEffect, useRef, useState, useLayoutEffect } from 'react'
import type { CSSProperties } from 'react'
import { Card, TranscriptLine, TickMark } from '@/types/overlay'
import { FCCard } from './FCCard'
import { CynicCard } from './CynicCard'
import { TickRail } from './TickRail'

interface TranscriptZoneProps {
  lines: TranscriptLine[]
  cards: Record<string, Card>
  interimText: string
  interimSpeaker: string
  pulsingId?: string | null
  isThinking?: boolean
  isHearingAudio?: boolean
  onBookmark?: (id: string) => void
  onReact?: (id: string, type: 'agree' | 'question' | 'comment') => void
  onPublish?: (id: string) => void
  onRenameSpeaker?: (speakerId: number, newName: string) => void
  isOBS?: boolean
}

interface SpeakerTurn {
  id: string
  speaker: string
  startTime: number
  lines: TranscriptLine[]
}

function groupIntoTurns(lines: TranscriptLine[]): SpeakerTurn[] {
  const turns: SpeakerTurn[] = []
  for (const line of lines) {
    const last = turns[turns.length - 1]
    const lastLine = last?.lines[last.lines.length - 1]
    // Merge ONLY when both the speaker label AND the underlying speakerId
    // match the previous line. speakerId distinguishes different Speechmatics
    // diarization labels even if they were both retroactively renamed to the
    // same person — so a brief misclassification interjection breaks the
    // paragraph instead of getting concatenated into someone else's turn.
    const sameSpeaker =
      last &&
      last.speaker === line.speaker &&
      lastLine?.speakerId === line.speakerId
    if (sameSpeaker) {
      last.lines.push(line)
    } else {
      turns.push({ id: line.id, speaker: line.speaker, startTime: line.timestamp, lines: [line] })
    }
  }
  return turns
}

function elapsedFromStart(startMs: number, lineMs: number): string {
  const s = Math.max(0, Math.floor((lineMs - startMs) / 1000))
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${h}:${m}:${sec}`
}

// Full-row backgrounds for triggered sentences. FC = blue tint, Cynic = green
// tint, plain = no bg. Speaker rows are rendered separately and never get a bg.
const ROW_BASE: CSSProperties = {
  fontFamily: 'var(--f-sans)',
  fontSize: 13,
  lineHeight: 1.68,
  color: 'rgba(255,255,255,0.82)',
  marginBottom: 2,
  transition: 'background 0.15s ease, border-left-color 0.15s ease, box-shadow 0.15s ease',
}
const ROW_PLAIN: CSSProperties = { ...ROW_BASE, padding: '3px 10px 3px 12px' }
// Triggered rows get extra vertical breathing room so they read as distinct
// "blocks" within the speaker's continuous transcript — the visual cue that
// they're tethered to a card on the left.
const ROW_FC: CSSProperties = {
  ...ROW_BASE,
  background: 'rgba(96,165,250,0.08)',
  borderLeft: '3px solid rgba(96,165,250,0.45)',
  borderRadius: '0 6px 6px 0',
  padding: '8px 10px 8px 12px',
  marginTop: 8,
  marginBottom: 8,
}
const ROW_CY: CSSProperties = {
  ...ROW_BASE,
  background: 'rgba(52,211,153,0.07)',
  borderLeft: '3px solid rgba(52,211,153,0.40)',
  borderRadius: '0 6px 6px 0',
  padding: '8px 10px 8px 12px',
  marginTop: 8,
  marginBottom: 8,
}
// Both FC + Cynic fired on the same line — diagonal gradient blue→green
// crossfade so the user sees both colors in the same row.
const ROW_BOTH: CSSProperties = {
  ...ROW_BASE,
  background: 'linear-gradient(110deg, rgba(96,165,250,0.10) 0%, rgba(96,165,250,0.07) 40%, rgba(52,211,153,0.07) 60%, rgba(52,211,153,0.10) 100%)',
  // Split-color left border via a separate layer (border-image) — half blue, half green
  borderLeft: '3px solid transparent',
  borderImage: 'linear-gradient(to bottom, rgba(96,165,250,0.45) 0%, rgba(96,165,250,0.45) 50%, rgba(52,211,153,0.40) 50%, rgba(52,211,153,0.40) 100%) 1',
  borderRadius: '0 6px 6px 0',
  padding: '8px 10px 8px 12px',
  marginTop: 8,
  marginBottom: 8,
}
// Active = hovered card or hovered row → brighten border + bg
const ROW_FC_ACTIVE: CSSProperties = {
  ...ROW_FC,
  background: 'rgba(96,165,250,0.16)',
  borderLeft: '3px solid rgba(96,165,250,0.85)',
  boxShadow: '0 0 0 1px rgba(96,165,250,0.18)',
}
const ROW_CY_ACTIVE: CSSProperties = {
  ...ROW_CY,
  background: 'rgba(52,211,153,0.14)',
  borderLeft: '3px solid rgba(52,211,153,0.80)',
  boxShadow: '0 0 0 1px rgba(52,211,153,0.18)',
}
const ROW_BOTH_ACTIVE: CSSProperties = {
  ...ROW_BOTH,
  background: 'linear-gradient(110deg, rgba(96,165,250,0.20) 0%, rgba(96,165,250,0.14) 40%, rgba(52,211,153,0.14) 60%, rgba(52,211,153,0.20) 100%)',
  borderImage: 'linear-gradient(to bottom, rgba(96,165,250,0.85) 0%, rgba(96,165,250,0.85) 50%, rgba(52,211,153,0.80) 50%, rgba(52,211,153,0.80) 100%) 1',
  boxShadow: '0 0 0 1px rgba(140,200,200,0.20)',
}
function rowStyle(line: TranscriptLine, lineCards: Card[], isActive: boolean): CSSProperties {
  // Only highlight if a card actually exists. The trigger flag is set
  // BEFORE the LLM responds — if the LLM returns nothing, no card is
  // created and the line should NOT be highlighted.
  const hasFC = lineCards.some(c => c.type === 'fc')
  const hasCY = lineCards.some(c => c.type === 'cynic')
  if (hasFC && hasCY) return isActive ? ROW_BOTH_ACTIVE : ROW_BOTH
  if (hasFC) return isActive ? ROW_FC_ACTIVE : ROW_FC
  if (hasCY) return isActive ? ROW_CY_ACTIVE : ROW_CY
  return ROW_PLAIN
}

// Numbered badge replacing the speaker avatar — colored by card type.
function NumberBadge({ n, type }: { n: number; type: 'fc' | 'cynic' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      borderRadius: 4,
      fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 700,
      color: '#fff',
      background: type === 'fc' ? 'var(--fc1)' : 'var(--cy1)',
      flexShrink: 0,
    }}>
      {n}
    </span>
  )
}

const CARD_COL = 190
const COL_GAP  = 8

function JumpToLatestButton({ onClick, newCount }: { onClick: () => void; newCount?: number }) {
  return (
    <button
      onClick={onClick}
      className="interactive"
      title={newCount && newCount > 0 ? `${newCount} new line${newCount === 1 ? '' : 's'} below — click to jump` : 'Jump to latest transcription'}
      style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        padding: '6px 14px',
        borderRadius: 999,
        background: 'rgba(20,20,24,0.92)',
        border: '1px solid rgba(255,255,255,0.30)',
        color: 'rgba(255,255,255,0.95)',
        cursor: 'pointer',
        fontFamily: 'var(--f-mono)',
        fontSize: 10,
        letterSpacing: '.08em',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
      LATEST
      {newCount && newCount > 0 ? (
        <span style={{
          marginLeft: 2,
          padding: '1px 6px',
          borderRadius: 999,
          background: 'rgba(249,115,22,0.85)',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          minWidth: 14,
          textAlign: 'center',
        }}>{newCount > 99 ? '99+' : newCount}</span>
      ) : null}
    </button>
  )
}

function ThinkingIndicator() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: 12,
      zIndex: 9,
      padding: '4px 10px',
      borderRadius: 999,
      background: 'rgba(20,20,24,0.78)',
      border: '1px solid rgba(255,255,255,0.10)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      pointerEvents: 'none',
      fontFamily: 'var(--f-mono)',
      fontSize: 9,
      letterSpacing: '.10em',
      color: 'rgba(255,255,255,0.62)',
      textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 999,
        background: 'rgba(96,165,250,0.85)',
        animation: 'thinkingPulse 1.1s ease-in-out infinite',
      }} />
      thinking
      <style>{`@keyframes thinkingPulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }`}</style>
    </div>
  )
}

function StickySpeakerBanner({ speaker }: { speaker: string }) {
  return (
    <div style={{
      position: 'absolute',
      top: 6,
      left: 8,
      right: 8,
      zIndex: 9,
      padding: '4px 10px',
      borderRadius: 8,
      background: 'rgba(20,20,24,0.85)',
      border: '1px solid rgba(255,255,255,0.10)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      pointerEvents: 'none',
      fontFamily: 'var(--f-mono)',
      fontSize: 10,
      letterSpacing: '.10em',
      color: 'rgba(255,255,255,0.78)',
      textTransform: 'uppercase',
      boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
    }}>
      {speaker}
    </div>
  )
}

function SpeakerHeader({
  speaker, elapsed, speakerId, onRename,
}: {
  speaker: string
  elapsed: string
  speakerId?: number
  onRename?: (speakerId: number, newName: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(speaker)
  const canRename = onRename && speakerId !== undefined && speakerId !== 0
  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== speaker && speakerId !== undefined) onRename?.(speakerId, trimmed)
  }
  const cancel = () => { setEditing(false); setDraft(speaker) }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      paddingBottom: 6,
      paddingTop: 'var(--sp2)',
      paddingLeft: 12,
    }}>
      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            list="annotated-speaker-suggestions"
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commit() }
              if (e.key === 'Escape') { e.preventDefault(); cancel() }
            }}
            style={{
              fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              color: '#fff',
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.30)',
              borderRadius: 3,
              padding: '1px 5px',
              outline: 'none',
              minWidth: 70, maxWidth: 160,
            }}
          />
          {/* Autocomplete suggestions for fast renaming during demos. The
              datalist is shared globally — defined once in TranscriptZone
              below so any speaker rename input picks it up. */}
        </>
      ) : (
        <span
          onClick={() => { if (canRename) { setDraft(speaker); setEditing(true) } }}
          title={canRename ? 'Click to rename this speaker' : undefined}
          style={{
            fontFamily: 'var(--f-mono)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.80)',
            cursor: canRename ? 'pointer' : 'default',
            borderBottom: canRename ? '1px dotted rgba(255,255,255,0.25)' : 'none',
          }}>
          {speaker}
        </span>
      )}
      {elapsed && (
        <span style={{
          fontFamily: 'var(--f-mono)',
          fontSize: 8,
          color: 'rgba(255,255,255,0.22)',
          letterSpacing: '0.04em',
          marginLeft: 'auto',
        }}>
          {elapsed}
        </span>
      )}
    </div>
  )
}

export function TranscriptZone({
  lines, cards, interimText, interimSpeaker, pulsingId, isThinking, isHearingAudio,
  onBookmark, onReact, onPublish, onRenameSpeaker, isOBS,
}: TranscriptZoneProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Suppresses handleScroll while a programmatic auto-scroll is in flight.
  // Without this, the smooth-scroll's intermediate events get misread as
  // user-initiated scroll-up and permanently disable auto-follow.
  const isAutoScrollingRef = useRef(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  // Refs to each transcript line, used to position cards next to their trigger
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Refs to each card, used for collision-aware vertical placement
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [cardTops, setCardTops] = useState<Record<string, number>>({})
  // Tracks the bottom-most pixel of any rendered card. Used to grow the
  // scroll container's effective height so auto-scroll lands at whichever is
  // further down — last transcript line OR last card. Without this, when a
  // tall card hangs past the final transcript line, scrollHeight doesn't
  // include the card (because cards are absolutely-positioned) and
  // auto-scroll stops short of the visual bottom.
  const [maxCardBottom, setMaxCardBottom] = useState(0)
  // Pinned cards: user clicked a collapsed card to keep it expanded
  const [pinnedCardIds, setPinnedCardIds] = useState<Set<string>>(new Set())
  // Hovered card: temporarily expand for read
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)
  const COLLAPSE_AFTER = 1  // only newest 2 stay expanded; 3rd+ auto-collapse
  const handleTogglePin = (cardId: string) => {
    setPinnedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId)
      return next
    })
  }
  const handleCardHoverChange = (cardId: string, hovered: boolean) => {
    setHoveredCardId(hovered ? cardId : null)
  }
  // Active line — set when the user hovers a card (highlights its trigger row)
  // OR hovers a triggered row (highlights its card). Reciprocal tether.
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [activeCardIds, setActiveCardIds] = useState<string[]>([])
  // True when the user has scrolled away from the bottom — used to surface
  // the "jump to latest" button so they can resume auto-scroll.
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  // Sticky speaker mini-header — name of the turn whose header has scrolled
  // above the viewport so the user always sees who's currently speaking.
  const [stickySpeaker, setStickySpeaker] = useState<string | null>(null)
  const turnHeaderRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Count of new lines that have arrived while the user is scrolled away —
  // surfaced as a count badge on the LATEST button.
  const [newLinesBelow, setNewLinesBelow] = useState(0)
  const lastSeenLinesCount = useRef(0)

  useEffect(() => {
    if (userScrolledRef.current) {
      // Track lines that arrived while the user was scrolled away.
      const delta = lines.length - lastSeenLinesCount.current
      if (delta > 0) setNewLinesBelow(delta)
    } else {
      lastSeenLinesCount.current = lines.length
      setNewLinesBelow(0)
    }
    if (!userScrolledRef.current && containerRef.current) {
      isAutoScrollingRef.current = true
      const el = containerRef.current
      el.scrollTop = el.scrollHeight
      window.requestAnimationFrame(() => {
        if (!userScrolledRef.current && containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
        window.requestAnimationFrame(() => {
          if (!userScrolledRef.current && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight
          }
          bottomRef.current?.scrollIntoView({ block: 'end' })
          isAutoScrollingRef.current = false
        })
      })
    }
  }, [lines.length, Object.keys(cards).length])

  // ResizeObserver — when card layout settles AFTER a re-render (cards are
  // absolutely-positioned and their measured height arrives later), the
  // scroll container's effective bottom moves. Re-snap whenever inner
  // content height changes and the user hasn't scrolled away.
  useEffect(() => {
    const c = containerRef.current
    if (!c || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const ro = new ResizeObserver(() => {
      if (userScrolledRef.current) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (!userScrolledRef.current && containerRef.current) {
          isAutoScrollingRef.current = true
          containerRef.current.scrollTop = containerRef.current.scrollHeight
          requestAnimationFrame(() => { isAutoScrollingRef.current = false })
        }
      })
    })
    // Observe the first content child so we react to inner-height changes
    const child = c.firstElementChild
    if (child) ro.observe(child)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  const handleScroll = () => {
    if (!containerRef.current) return
    // Ignore scroll events triggered by our own auto-scroll animation.
    if (isAutoScrollingRef.current) return
    const container = containerRef.current
    const { scrollTop, scrollHeight, clientHeight } = container
    const scrolledUp = scrollTop < scrollHeight - clientHeight - 40
    userScrolledRef.current = scrolledUp
    setShowJumpToLatest(scrolledUp)
    if (!scrolledUp) {
      setNewLinesBelow(0)
      lastSeenLinesCount.current = lines.length
    }

    // Compute which turn header has scrolled above the visible area.
    // Sticky shows the most-recent header whose top is above scrollTop.
    const containerTop = container.getBoundingClientRect().top
    let above: string | null = null
    for (const turn of turns) {
      const el = turnHeaderRefs.current[turn.id]
      if (!el) continue
      const headerTop = el.getBoundingClientRect().top - containerTop
      if (headerTop < 0) above = turn.speaker
      else break
    }
    setStickySpeaker(above)
  }

  const jumpToLatest = () => {
    userScrolledRef.current = false
    setShowJumpToLatest(false)
    setNewLinesBelow(0)
    lastSeenLinesCount.current = lines.length
    if (containerRef.current) {
      isAutoScrollingRef.current = true
      const el = containerRef.current
      el.scrollTop = el.scrollHeight
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          isAutoScrollingRef.current = false
        })
      })
    }
  }

  const turns = groupIntoTurns(lines)
  const sessionStart = lines[0]?.timestamp ?? 0
  // ALWAYS reserve the card column — transcript must NEVER spill into it,
  // whether cards exist or not. Single-column only used for OBS embed.
  const twoCol = !isOBS

  // Single-column path (OBS embed only)
  if (!twoCol) {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          position: 'absolute', inset: 0,
          overflowY: 'auto', overflowX: 'hidden',
          padding: 'var(--sp3) var(--sp3) 40px var(--sp3)',
        }}
      >
        {turns.map(turn => {
          // Same paragraph-merging logic as the two-col path
          type Para = { kind: 'text'; key: string; text: string } | { kind: 'triggered'; line: TranscriptLine; lineCards: Card[] }
          const paragraphs: Para[] = []
          let buffer: TranscriptLine[] = []
          const flush = () => {
            if (buffer.length === 0) return
            paragraphs.push({ kind: 'text', key: buffer[0].id, text: buffer.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim() })
            buffer = []
          }
          for (const line of turn.lines) {
            const lineCards = (line.cardIds ?? []).map(id => cards[id]).filter(Boolean) as Card[]
            if (lineCards.length > 0) { flush(); paragraphs.push({ kind: 'triggered', line, lineCards }) }
            else buffer.push(line)
          }
          flush()
          return (
            <div key={turn.id} style={{ marginBottom: 'var(--sp3)' }}>
              <SpeakerHeader
                speaker={turn.speaker}
                speakerId={turn.lines[0]?.speakerId}
                onRename={onRenameSpeaker}
                elapsed={sessionStart ? elapsedFromStart(sessionStart, turn.startTime) : ''}
              />
              {paragraphs.map(para => {
                if (para.kind === 'text') {
                  return (
                    <div key={para.key} style={{
                      fontFamily: 'var(--f-sans)', fontSize: 13, lineHeight: 1.68,
                      color: 'rgba(255,255,255,0.82)',
                      padding: '3px 10px 3px 12px', marginBottom: 2,
                    }}>{para.text}</div>
                  )
                }
                return <div key={para.line.id} style={rowStyle(para.line, para.lineCards, false)}>{para.line.text}</div>
              })}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      {showJumpToLatest && <JumpToLatestButton onClick={jumpToLatest} newCount={newLinesBelow} />}
      {stickySpeaker && <StickySpeakerBanner speaker={stickySpeaker} />}
      {isThinking && <ThinkingIndicator />}
      </div>
    )
  }

  // Build ordered card list — keyed to triggerLineId, in line order.
  // Sequential numbering (1, 2, 3…) is assigned by line order so the user can
  // visually correlate the speaker-row badges with the card-header badges.
  // Once-flag: flips true the moment any card has ever rendered this session.
  // Drives the single→two-column animation. Never flips back, even if all
  // cards roll off via MAX_LINES — once you've seen the columns split, they
  // stay split for the rest of the session.
  const [hasCardsEver, setHasCardsEver] = useState(false)

  const orderedCards: { card: Card; lineId: string; n: number }[] = []
  const cardNumberById: Record<string, number> = {}
  {
    const seen = new Set<string>()
    let counter = 0
    for (const turn of turns) {
      for (const line of turn.lines) {
        for (const cardId of (line.cardIds ?? [])) {
          if (!seen.has(cardId) && cards[cardId]) {
            seen.add(cardId)
            counter += 1
            cardNumberById[cardId] = counter
            orderedCards.push({ card: cards[cardId], lineId: line.id, n: counter })
          }
        }
      }
    }
  }
  // Per-turn card list for the speaker badge row
  const turnCardsById: Record<string, { n: number; type: 'fc' | 'cynic' }[]> = {}
  for (const turn of turns) {
    const list: { n: number; type: 'fc' | 'cynic' }[] = []
    for (const line of turn.lines) {
      for (const cardId of (line.cardIds ?? [])) {
        const c = cards[cardId]
        const n = cardNumberById[cardId]
        if (c && n) list.push({ n, type: c.type === 'fc' ? 'fc' : 'cynic' })
      }
    }
    turnCardsById[turn.id] = list
  }

  // After every render, measure each line's offsetTop and each card's height,
  // then compute non-overlapping vertical positions for the cards in the left
  // column. Cards float at their trigger line's Y; if the previous card would
  // overlap, push this one down.
  const recomputeCardTops = React.useCallback(() => {
    const tops: Record<string, number> = {}
    let lastBottom = -Infinity
    const CARD_GAP = 8
    for (const { card, lineId } of orderedCards) {
      const lineEl = lineRefs.current[lineId]
      if (!lineEl) continue
      const naturalTop = lineEl.offsetTop
      const cardEl = cardRefs.current[card.id]
      const cardH = cardEl?.offsetHeight ?? 0
      const top = Math.max(naturalTop, lastBottom + CARD_GAP)
      tops[card.id] = top
      lastBottom = top + cardH
    }
    setCardTops(prev => {
      // Only update if positions actually changed (avoids render loops)
      const prevKeys = Object.keys(prev)
      const newKeys = Object.keys(tops)
      if (prevKeys.length !== newKeys.length) return tops
      for (const k of newKeys) {
        if (prev[k] !== tops[k]) return tops
      }
      return prev
    })
    setMaxCardBottom(prev => (Math.abs(prev - lastBottom) < 2 ? prev : lastBottom))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCards])

  // Flip the column-layout flag the first time any card appears. Stays true
  // for the rest of the session — see comment at hasCardsEver definition.
  useEffect(() => {
    if (orderedCards.length > 0 && !hasCardsEver) setHasCardsEver(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCards.length, hasCardsEver])

  // Recompute on data change
  useLayoutEffect(() => {
    recomputeCardTops()
  }, [lines, cards, interimText, recomputeCardTops])

  // Recompute on container/window resize — when the user widens the overlay,
  // text reflows to different Y positions, so cards must follow.
  useEffect(() => {
    const transcriptEl = transcriptRef.current
    const containerEl = containerRef.current
    if (!transcriptEl && !containerEl) return
    const ro = new ResizeObserver(() => recomputeCardTops())
    if (transcriptEl) ro.observe(transcriptEl)
    if (containerEl) ro.observe(containerEl)
    // Fallback: also listen to window resize for good measure
    const onResize = () => recomputeCardTops()
    window.addEventListener('resize', onResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [recomputeCardTops])

  // Recompute when any card's intrinsic content changes height (e.g. citations
  // hydrate after the initial render — card grows taller and would overlap).
  useEffect(() => {
    const cardEls = Object.values(cardRefs.current).filter(Boolean) as HTMLDivElement[]
    if (cardEls.length === 0) return
    const ro = new ResizeObserver(() => recomputeCardTops())
    cardEls.forEach(el => ro.observe(el))
    return () => ro.disconnect()
  }, [orderedCards.length, recomputeCardTops])

  // Two-column path: continuous transcript flow on the right, absolute-positioned
  // cards floating in the left column anchored to their trigger line. This
  // eliminates the "tall card stretches the row" gap problem.
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
    {/* Speaker-name autocomplete shared by every SpeakerHeader rename input.
        Lets the user type one letter and pick the right TWiST/All-In cast
        member. Especially useful during demos when voiceprint ID is off. */}
    <datalist id="annotated-speaker-suggestions">
      <option value="Jason" /><option value="Lon" /><option value="Alex" />
      <option value="Oliver" /><option value="Nick" />
      <option value="Chamath" /><option value="Sacks" /><option value="Friedberg" />
      <option value="Garry" /><option value="Naval" /><option value="Larry Summers" />
      <option value="Bill Gurley" /><option value="Brad Gerstner" />
    </datalist>
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        position: 'absolute', inset: 0,
        overflowY: 'auto', overflowX: 'hidden',
        padding: 'var(--sp3) var(--sp3) 40px var(--sp3)',
      }}
    >
      <div style={{ position: 'relative', minHeight: maxCardBottom + 40 }}>

        {/* LEFT: absolute-positioned cards anchored to their trigger line.
            Width animates 0 → CARD_COL the first time a card fires; opacity
            fades in 200ms behind the width animation so cards don't ghost
            into a still-collapsing column. Never reverts. */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0,
          width: hasCardsEver ? CARD_COL : 0,
          opacity: hasCardsEver ? 1 : 0,
          // overflow:hidden is needed during the closed→open animation to
          // prevent cards bleeding sideways while width=0. Once expanded,
          // switch to visible so the card column doesn't clip cards (which
          // are absolutely-positioned inside this container — their height
          // doesn't contribute to the parent's auto-height, leaving the
          // parent at height:0 which would clip every card to invisibility).
          overflow: hasCardsEver ? 'visible' : 'hidden',
          transition: 'width 400ms cubic-bezier(.4,0,.2,1), opacity 300ms ease 200ms',
        }}>
          {orderedCards.map(({ card, lineId, n }, idx) => {
            // Auto-collapse cards that aren't in the most recent COLLAPSE_AFTER+1.
            // orderedCards is chronological (oldest first), so newest is at the
            // end. Distance from end = orderedCards.length - 1 - idx.
            const distanceFromNewest = orderedCards.length - 1 - idx
            const isOld = distanceFromNewest > COLLAPSE_AFTER
            const isPinned = pinnedCardIds.has(card.id)
            const isHovered = hoveredCardId === card.id
            const isCollapsed = isOld && !isPinned && !isHovered
            return (
            <div
              key={card.id}
              ref={el => { cardRefs.current[card.id] = el }}
              onMouseEnter={() => { setActiveLineId(lineId); setActiveCardIds([card.id]) }}
              onMouseLeave={() => { setActiveLineId(null); setActiveCardIds([]) }}
              style={{
                position: 'absolute',
                top: cardTops[card.id] ?? 0,
                left: 0, right: 0,
                opacity: cardTops[card.id] === undefined ? 0 : 1,
                transform: activeCardIds.includes(card.id) ? 'translateX(-2px)' : 'translateX(0)',
                filter: activeCardIds.includes(card.id) ? 'drop-shadow(0 0 6px rgba(255,255,255,0.10))' : 'none',
                transition: 'top 0.2s ease, opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease',
                zIndex: isHovered ? 5 : 1,  // hover-expand floats above neighbors
              }}
            >
              {card.type === 'fc' ? (
                <FCCard
                  card={card}
                  cardNumber={n}
                  showComments={true}
                  onBookmark={onBookmark}
                  onReact={onReact}
                  onPublish={onPublish}
                  isPulsing={pulsingId === card.id}
                  isCollapsed={isCollapsed}
                  isPinned={isPinned}
                  onTogglePin={handleTogglePin}
                  onHoverChange={handleCardHoverChange}
                />
              ) : (
                <CynicCard
                  card={card}
                  cardNumber={n}
                  onReact={onReact}
                  isPulsing={pulsingId === card.id}
                  isCollapsed={isCollapsed}
                  isPinned={isPinned}
                  onTogglePin={handleTogglePin}
                  onHoverChange={handleCardHoverChange}
                />
              )}
            </div>
          )})}
        </div>

        {/* RIGHT: continuous transcript. Indented past the card column once
            the layout splits; full-width before any card has ever fired. */}
        <div
          ref={transcriptRef}
          style={{
            marginLeft: hasCardsEver ? CARD_COL + COL_GAP : 0,
            transition: 'margin-left 400ms cubic-bezier(.4,0,.2,1)',
          }}
        >
          {turns.map(turn => {
            const elapsed = sessionStart ? elapsedFromStart(sessionStart, turn.startTime) : ''
            // Merge consecutive non-triggered lines from this speaker into a
            // single continuous paragraph. Triggered lines keep their own row
            // (with the highlight, card-anchor ref, and badges). Net result:
            // visual breaks ONLY when (a) speaker changes, (b) a card fires.
            type Para =
              | { kind: 'text'; key: string; text: string }
              | { kind: 'triggered'; line: TranscriptLine; lineCards: Card[] }
            const paragraphs: Para[] = []
            let buffer: TranscriptLine[] = []
            const flushBuffer = () => {
              if (buffer.length === 0) return
              paragraphs.push({
                kind: 'text',
                key: buffer[0].id,
                text: buffer.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim(),
              })
              buffer = []
            }
            for (const line of turn.lines) {
              const lineCards = (line.cardIds ?? []).map(id => cards[id]).filter(Boolean) as Card[]
              if (lineCards.length > 0) {
                flushBuffer()
                paragraphs.push({ kind: 'triggered', line, lineCards })
              } else {
                buffer.push(line)
              }
            }
            flushBuffer()

            return (
              <div key={turn.id}>
                <div ref={el => { turnHeaderRefs.current[turn.id] = el }}>
                  <SpeakerHeader
                    speaker={turn.speaker}
                    speakerId={turn.lines[0]?.speakerId}
                    onRename={onRenameSpeaker}
                    elapsed={elapsed}
                  />
                </div>
                {paragraphs.map(para => {
                  if (para.kind === 'text') {
                    return (
                      <div
                        key={para.key}
                        style={{
                          fontFamily: 'var(--f-sans)',
                          fontSize: 13,
                          lineHeight: 1.68,
                          color: 'rgba(255,255,255,0.82)',
                          padding: '3px 10px 5px 12px',
                          marginBottom: 5,
                        }}
                      >
                        {para.text}
                      </div>
                    )
                  }
                  // triggered row — full styling with highlight, badges, hover
                  const { line, lineCards } = para
                  const isActive = activeLineId === line.id
                  const lineBadges = lineCards
                    .map(c => ({ n: cardNumberById[c.id], type: (c.type === 'fc' ? 'fc' : 'cynic') as 'fc' | 'cynic' }))
                    .filter(b => !!b.n)
                  return (
                    <div
                      key={line.id}
                      ref={el => { lineRefs.current[line.id] = el }}
                      onMouseEnter={() => {
                        setActiveLineId(line.id)
                        setActiveCardIds(lineCards.map(c => c.id))
                      }}
                      onMouseLeave={() => {
                        setActiveLineId(null)
                        setActiveCardIds([])
                      }}
                      style={{
                        ...rowStyle(line, lineCards, isActive),
                        cursor: 'pointer',
                      }}
                    >
                      {lineBadges.length > 0 && (
                        <span style={{ display: 'inline-flex', gap: 3, marginRight: 6, verticalAlign: 'middle' }}>
                          {lineBadges.map((b, i) => (
                            <NumberBadge key={`${b.type}-${b.n}-${i}`} n={b.n} type={b.type} />
                          ))}
                        </span>
                      )}
                      {line.text}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Listening pulse — replaces the old word-by-word interim text.
              Solid blocks now appear whole when Speechmatics finalizes; this
              tiny dot just confirms the system is hearing audio during long
              monologues that haven't yet hit a finalization pause. */}
          {isHearingAudio && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 10px 8px 12px',
              fontFamily: 'var(--f-mono)',
              fontSize: 9, letterSpacing: '.10em',
              color: 'rgba(255,255,255,0.42)',
              textTransform: 'uppercase',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999,
                background: 'rgba(249,115,22,0.85)',
                animation: 'thinkingPulse 1.1s ease-in-out infinite',
              }} />
              listening
            </div>
          )}
        </div>
      </div>
      <div ref={bottomRef} />
    </div>
    {showJumpToLatest && <JumpToLatestButton onClick={jumpToLatest} />}

    {/* Tick rail — vertical timeline of every card on the right edge.
        Click a tick to jump to + pin-expand its card. Hover to preview. */}
    {!isOBS && orderedCards.length > 0 && (
      <TickRail
        ticks={orderedCards.map(({ card }): TickMark => ({
          id: card.id,
          type: card.type === 'fc' ? 'fc' : 'cynic',
          timestamp: card.timestamp,
          cardId: card.id,
          comment: card.comment || card.fallacyLabel || '',
          triggerSentence: card.triggerSentence || '',
          elapsed: card.elapsed || '',
        }))}
        sessionStartTime={sessionStart || Date.now()}
        onTickClick={(tick) => {
          // Pin the card so it stays expanded
          setPinnedCardIds(prev => {
            const next = new Set(prev)
            next.add(tick.cardId)
            return next
          })
          // Scroll the transcript to the card's trigger line
          const card = cards[tick.cardId]
          const lineEl = card ? lineRefs.current[card.triggerLineId] : null
          const cardEl = cardRefs.current[tick.cardId]
          const target = cardEl || lineEl
          if (target && containerRef.current) {
            const c = containerRef.current
            const t = target.getBoundingClientRect()
            const cr = c.getBoundingClientRect()
            c.scrollBy({ top: t.top - cr.top - 80, behavior: 'smooth' })
          }
        }}
      />
    )}
    </div>
  )
}
