'use client'
import { Card } from '@/types/overlay'
import { FCCard } from './FCCard'
import { CynicCard } from './CynicCard'

interface PinnedZoneProps {
  cards: Card[]  // max 2, most recent first
  showComments?: boolean
  onBookmark?: (id: string) => void
  onReact?: (id: string, type: 'agree' | 'question' | 'comment') => void
  onPublish?: (id: string) => void
  pulsingId?: string | null
  isOBS?: boolean
}

export function PinnedZone({
  cards, showComments, onBookmark, onReact, onPublish, pulsingId, isOBS
}: PinnedZoneProps) {
  if (cards.length === 0) return null

  return (
    <div style={{
      padding: 'var(--sp2) var(--sp3) 0 var(--sp3)',
      display: 'flex', flexDirection: 'column', gap: 'var(--sp2)',
      flexShrink: 0,
    }}>
      {cards.map(card => (
        card.type === 'fc' ? (
          <FCCard
            key={card.id}
            card={card}
            showComments={showComments && !isOBS}
            onBookmark={!isOBS ? onBookmark : undefined}
            onReact={isOBS ? undefined : onReact}
            onPublish={!isOBS ? onPublish : undefined}
            isPulsing={pulsingId === card.id}
          />
        ) : (
          <CynicCard
            key={card.id}
            card={card}
            onReact={isOBS ? undefined : onReact}
            isPulsing={pulsingId === card.id}
          />
        )
      ))}
    </div>
  )
}
