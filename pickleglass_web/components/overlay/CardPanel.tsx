'use client'
import { useEffect, useRef } from 'react'
import { Card } from '@/types/overlay'
import { FCCard } from './FCCard'
import { CynicCard } from './CynicCard'

interface CardPanelProps {
  cards: Card[]  // ordered oldest → newest
  showComments?: boolean
  onBookmark?: (id: string) => void
  onReact?: (id: string, type: 'agree' | 'question' | 'comment') => void
  onPublish?: (id: string) => void
  pulsingId?: string | null
  cardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
}

export function CardPanel({
  cards, showComments, onBookmark, onReact, onPublish, pulsingId, cardRefs
}: CardPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)

  useEffect(() => {
    if (!userScrolledRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [cards.length])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    userScrolledRef.current = scrollTop < scrollHeight - clientHeight - 40
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: '0 0 190px',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp2)',
        padding: 'var(--sp2)',
        background: 'rgba(0,0,0,0.06)',
      }}
    >
      {cards.length === 0 && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--f-mono)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--t3)',
          textAlign: 'center',
          padding: 'var(--sp3)',
          letterSpacing: '.06em',
          opacity: 0.5,
        }}>
          cards<br/>appear<br/>here
        </div>
      )}

      {cards.map(card => (
        <div
          key={card.id}
          ref={el => { cardRefs.current[card.id] = el }}
        >
          {card.type === 'fc' ? (
            <FCCard
              card={card}
              showComments={showComments}
              onBookmark={onBookmark}
              onReact={onReact}
              onPublish={onPublish}
              isPulsing={pulsingId === card.id}
            />
          ) : (
            <CynicCard
              card={card}
              onReact={onReact}
              isPulsing={pulsingId === card.id}
            />
          )}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  )
}
