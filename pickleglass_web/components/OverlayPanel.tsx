'use client'
import { useRef, useState, useCallback } from 'react'
import { Card, TranscriptLine } from '@/types/overlay'
import { Header } from './overlay/Header'
import { TranscriptZone } from './overlay/TranscriptZone'

interface OverlayPanelProps {
  // Header
  speaker: string
  topic: string
  isLive: boolean
  isPublic: boolean
  isListening: boolean
  onTogglePrivacy: () => void
  onStartListening: () => void
  onStopListening: () => void
  onResetTranscript: () => void

  // Transcript
  lines: TranscriptLine[]
  cards: Record<string, Card>
  interimText: string
  interimSpeaker: string
  pulsingId?: string | null
  isThinking?: boolean
  isHearingAudio?: boolean

  // Actions
  onBookmark: (id: string) => void
  onReact: (id: string, type: 'agree' | 'question' | 'comment') => void
  onPublish: (id: string) => void
  onRenameSpeaker?: (speakerId: number, newName: string) => void

  // OBS mode
  isOBS?: boolean
}

export function OverlayPanel({
  speaker, topic, isLive, isPublic,
  isListening, onTogglePrivacy, onStartListening, onStopListening, onResetTranscript,
  lines, cards, interimText, interimSpeaker, pulsingId, isThinking, isHearingAudio,
  onBookmark, onReact, onPublish, onRenameSpeaker,
  isOBS,
}: OverlayPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const savedHeight = useRef<number | null>(null)

  const handleToggleMinimize = useCallback(() => {
    const next = !isMinimized
    setIsMinimized(next)
    const api = (window as any).api?.annotated
    if (!api?.getBounds || !api?.setBounds) return
    api.getBounds().then((bounds: { x: number; y: number; width: number; height: number }) => {
      if (next) {
        savedHeight.current = bounds.height
        api.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: 54 })
      } else {
        const restore = savedHeight.current ?? window.screen.availHeight
        api.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: restore })
      }
    }).catch(() => {})
  }, [isMinimized])

  return (
    <div
      className={isOBS ? 'overlay-panel' : 'overlay-panel liquid-glass'}
      style={{
        position: 'fixed',
        left: isOBS ? 0 : 6,
        top: isOBS ? 0 : 6,
        width: isOBS ? '100%' : 'calc(100% - 12px)',
        height: isOBS ? '100vh' : 'calc(100vh - 12px)',
        display: 'flex',
        flexDirection: 'column',
        background: isOBS ? 'transparent' : undefined,
        backdropFilter: isOBS ? 'none' : undefined,
        WebkitBackdropFilter: isOBS ? 'none' : undefined,
        border: isOBS ? 'none' : undefined,
        borderRadius: isOBS ? 0 : '16px',
        overflow: 'hidden',
        pointerEvents: isOBS ? 'none' : 'auto',
      } as React.CSSProperties}
    >
      {/* Header */}
      {!isOBS && (
        <Header
          speaker={speaker}
          topic={topic}
          isLive={isLive}
          isPublic={isPublic}
          isMinimized={isMinimized}
          isListening={isListening}
          onTogglePrivacy={onTogglePrivacy}
          onToggleMinimize={handleToggleMinimize}
          onStartListening={onStartListening}
          onStopListening={onStopListening}
          onResetTranscript={onResetTranscript}
        />
      )}

      {/* Full-width transcript with inline cards */}
      {!isMinimized && (
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <TranscriptZone
            lines={lines}
            cards={cards}
            interimText={interimText}
            interimSpeaker={interimSpeaker}
            pulsingId={pulsingId}
            isThinking={isThinking}
            isHearingAudio={isHearingAudio}
            onBookmark={onBookmark}
            onReact={onReact}
            onPublish={onPublish}
            onRenameSpeaker={onRenameSpeaker}
            isOBS={isOBS}
          />
        </div>
      )}

      {/* Right-edge resize zone — wide invisible strip so user doesn't have to
          pixel-hunt the OS-level edge. Native Electron resize hit area is ~5px;
          this gives a 16px-wide grab zone with custom drag-to-resize via
          setBounds IPC. */}
      {!isOBS && (
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            const api = (window as any).api?.annotated
            if (!api?.getBounds || !api?.setBounds) return
            api.getBounds().then((b: { x: number; y: number; width: number; height: number }) => {
              const startX = e.screenX
              const startW = b.width
              const onMove = (ev: MouseEvent) => {
                const next = Math.max(320, Math.min(1200, startW + (ev.screenX - startX)))
                api.setBounds({ x: b.x, y: b.y, width: next, height: b.height })
              }
              const onUp = () => {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }).catch(() => {})
          }}
          style={{
            position: 'absolute',
            top: 0, bottom: 0,
            right: 0,
            width: 7,
            cursor: 'ew-resize',
            zIndex: 50,
            // invisible — just a hit zone
          }}
        />
      )}
    </div>
  )
}
