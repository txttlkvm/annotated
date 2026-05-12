'use client'
import { useState } from 'react'
import { TickMark } from '@/types/overlay'
import { TickTooltip } from './TickTooltip'

interface TickRailProps {
  ticks: TickMark[]
  sessionStartTime: number
  onTickClick: (tick: TickMark) => void
  isOBS?: boolean
}

// Fixed pixel spacing — first tick at the top, each subsequent tick stacks
// down. Doesn't depend on session duration, so ticks don't drift over time.
const TICK_TOP_OFFSET = 12
const TICK_SPACING = 16

export function TickRail({ ticks, onTickClick, isOBS }: TickRailProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  // Ticks render in chronological order — newest at the bottom of the stack.
  return (
    <div style={{
      position: 'absolute', right: 8, top: 0, bottom: 0,
      width: 22,
      zIndex: 10,
    }}>
      {/* Vertical track */}
      <div style={{
        position: 'absolute', left: '50%', top: 8, bottom: 8,
        width: 1, background: 'rgba(255,255,255,0.12)',
        transform: 'translateX(-50%)',
      }} />

      {/* Tick marks — fixed-spacing stack from the top, no time-based drift */}
      {ticks.map((tick, idx) => {
        const topPx = TICK_TOP_OFFSET + idx * TICK_SPACING
        const color = tick.type === 'fc' ? 'var(--fc1)'
          : tick.type === 'cynic' ? 'var(--cy1)'
          : 'var(--a1)'
        const isHovered = hoveredId === tick.id
        // Anchor tooltip below tick when in top half, above when in bottom half,
        // so it stays visible inside the overlay.
        const totalRailHeight = TICK_TOP_OFFSET + ticks.length * TICK_SPACING
        const tooltipBelow = topPx < totalRailHeight / 2
        return (
          <div
            key={tick.id}
            style={{
              position: 'absolute',
              top: topPx,
              left: '50%',
              transform: 'translateX(-50%)',
              width: isHovered ? 22 : 18,
              height: 3,
              borderRadius: 2,
              background: color,
              opacity: isHovered ? 1 : 0.55,
              cursor: isOBS ? 'default' : 'pointer',
              transition: 'width .15s, opacity .15s',
            }}
            onClick={() => !isOBS && onTickClick(tick)}
            onMouseEnter={() => !isOBS && setHoveredId(tick.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {isHovered && !isOBS && (
              <div style={{
                position: 'absolute',
                right: '100%',
                ...(tooltipBelow ? { top: 0 } : { bottom: 0 }),
                marginRight: 8,
              }}>
                <TickTooltip tick={tick} />
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}
