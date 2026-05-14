'use client'
import { useState, useRef } from 'react'

/* Inline SVG filter for the liquid-glass header. feTurbulence generates
   fractal noise, feGaussianBlur smooths it, feDisplacementMap warps the
   backdrop pixels through that noise — produces the wavy refractive
   distortion you see on iOS liquid-glass surfaces. Chromium-only on
   backdrop-filter (we're Electron, so fine). Hidden from layout via
   position:absolute + 0×0 svg. */
/* Clear-glass-with-strong-ripple recipe — backdrop stays sharp, only
   refracts through the noise. Three displacement passes at slightly
   different scales, isolated by RGB channel via feColorMatrix, then
   feBlend mode="screen" recomposes — gives the prismatic chromatic-
   aberration fringing of real refractive glass. */
function LiquidGlassFilter() {
  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        <filter
          id="liquid-glass-header"
          x="-20%" y="-20%" width="140%" height="140%"
          colorInterpolationFilters="sRGB"
        >
          {/* Smoothed fractal-noise displacement map */}
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1.6" result="dispMap" />

          {/* 3 displacement passes at differing scales — chromatic aberration */}
          <feDisplacementMap in="SourceGraphic" in2="dispMap" scale="32" xChannelSelector="R" yChannelSelector="G" result="rDisp" />
          <feDisplacementMap in="SourceGraphic" in2="dispMap" scale="38" xChannelSelector="R" yChannelSelector="G" result="gDisp" />
          <feDisplacementMap in="SourceGraphic" in2="dispMap" scale="44" xChannelSelector="R" yChannelSelector="G" result="bDisp" />

          {/* Isolate each color channel of its pass */}
          <feColorMatrix in="rDisp" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rOnly" />
          <feColorMatrix in="gDisp" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="gOnly" />
          <feColorMatrix in="bDisp" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bOnly" />

          {/* Recompose */}
          <feBlend in="rOnly" in2="gOnly" mode="screen" result="rg" />
          <feBlend in="rg" in2="bOnly" mode="screen" />
        </filter>
      </defs>
    </svg>
  )
}

interface HeaderProps {
  speaker: string
  topic: string
  isLive: boolean
  isPublic: boolean
  isMinimized: boolean
  isListening: boolean
  onTogglePrivacy: () => void
  onToggleMinimize: () => void
  onStartListening: () => void
  onStopListening: () => void
  onResetTranscript: () => void
}

export function Header({
  speaker, topic, isLive, isPublic, isMinimized,
  isListening, onTogglePrivacy, onToggleMinimize,
  onStartListening, onStopListening, onResetTranscript,
}: HeaderProps) {
  // Reset uses a click-to-confirm pattern: first click changes the icon
  // to "?" with a red tint and a tooltip "Click again to clear transcript".
  // Second click within 3s actually fires the reset. Auto-reverts otherwise.
  const [resetArmed, setResetArmed] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleResetClick = () => {
    if (resetArmed) {
      if (resetTimer.current) clearTimeout(resetTimer.current)
      setResetArmed(false)
      onResetTranscript()
      return
    }
    setResetArmed(true)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setResetArmed(false), 3000)
  }
  return (
    <>
    <LiquidGlassFilter />
    <div style={{
      position: 'relative',
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 var(--sp3)',
      gap: 0,
      flexShrink: 0,
      WebkitAppRegion: 'drag',
      cursor: 'grab',
      /* Clear-glass: blur(0px) just triggers the stacking context so the
         SVG filter can refract the backdrop; saturate(115%) keeps colors
         vivid without softening. The displacement filter does ALL the
         visual work — strong ripple, no haze. Surface stays nearly
         transparent so you can see through. */
      backdropFilter: 'url(#liquid-glass-header) blur(0px) saturate(115%)',
      WebkitBackdropFilter: 'saturate(115%)',
      background:
        'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 55%, rgba(255,255,255,0.06) 100%)',
      borderBottom: 'none',
      boxShadow: [
        '0 4px 16px rgba(0,0,0,0.32)',
        'inset 0 1px 0 rgba(255,255,255,0.45)',
        'inset 0 -1px 0 rgba(255,255,255,0.08)',
      ].join(', '),
    } as React.CSSProperties}>

      {/* Live dot — orange + pulsing while recording, gray + static when stopped */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: isListening ? 'var(--a1)' : 'rgba(255,255,255,0.30)',
        animation: isListening ? 'pulse 1.4s ease-in-out infinite' : 'none',
        flexShrink: 0,
        boxShadow: isListening ? '0 0 6px 2px rgba(249,115,22,0.6)' : 'none',
        transition: 'background 0.2s ease, box-shadow 0.2s ease',
      }} />

      {/* ½ inch gap (≈ 48px) between live dot and start button */}
      <div style={{ width: 48, flexShrink: 0 }} />

      {/* Start / Stop listening — sized to match the Private/Public pill */}
      <button
        onClick={isListening ? onStopListening : onStartListening}
        className="interactive"
        title={isListening ? 'Stop listening' : 'Start listening'}
        style={{
          background: isListening ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${isListening ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.40)'}`,
          borderRadius: 20,
          color: isListening ? '#f97316' : 'rgba(255,255,255,0.90)',
          cursor: 'pointer',
          padding: '4px 10px',
          minWidth: 52,
          fontFamily: 'var(--f-mono)',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '.10em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
          boxShadow: isListening
            ? '0 0 5px 1px rgba(249,115,22,0.18), inset 0 0 4px rgba(249,115,22,0.04)'
            : '0 0 5px 1px rgba(255,255,255,0.10), inset 0 0 4px rgba(255,255,255,0.04)',
          transition: 'all 0.22s ease',
        } as React.CSSProperties}>
        {isListening
          ? <><span style={{ width: 6, height: 6, borderRadius: 1, background: '#f97316', display: 'inline-block', flexShrink: 0 }} />STOP</>
          : <><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.55)', display: 'inline-block', flexShrink: 0 }} />START</>
        }
      </button>

      {/* ½ inch gap (≈ 48px) between start button and privacy pill */}
      <div style={{ width: 48, flexShrink: 0 }} />

      {/* PRIVATE / PUBLIC pill */}
      <div
        onClick={onTogglePrivacy}
        className="interactive"
        title={isPublic ? 'Public — tap to go private' : 'Private — tap to go public'}
        style={{
          cursor: 'pointer',
          padding: '4px 10px',
          borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 52,
          flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.40)',
          background: 'rgba(255,255,255,0.06)',
          boxShadow: '0 0 5px 1px rgba(255,255,255,0.10), inset 0 0 4px rgba(255,255,255,0.04)',
          transition: 'all 0.22s ease',
          userSelect: 'none',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}>
        <span style={{
          fontFamily: 'var(--f-mono)',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '.10em',
          paddingLeft: '.10em',
          color: isPublic ? '#f97316' : 'rgba(255,255,255,0.90)',
          transition: 'color 0.22s ease',
        }}>
          {isPublic ? 'PUBLIC' : 'PRIVATE'}
        </span>
      </div>

      {/* Topic — fills the middle, takes the rest of the space */}
      {topic ? (
        <span style={{
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color: 'rgba(255,255,255,0.60)', letterSpacing: '.06em',
          borderLeft: '1px solid rgba(255,255,255,0.12)',
          paddingLeft: 'var(--sp2)', marginLeft: 'var(--sp3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, minWidth: 0,
        }}>
          ◆ {topic}
        </span>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }} />
      )}

      {/* Reset transcript — two-click confirm. First click arms (red ring +
          "?" cursor + warning tooltip), second click within 3s clears the
          transcript and all cards. Auto-disarms after 3s. */}
      <button
        onClick={handleResetClick}
        className="interactive"
        title={resetArmed
          ? 'Click again to clear the transcript and all cards'
          : 'Reset transcript (click then click again to confirm)'}
        style={{
          background: resetArmed ? 'rgba(239,68,68,0.18)' : 'none',
          border: resetArmed ? '1px solid rgba(239,68,68,0.55)' : '1px solid transparent',
          borderRadius: '50%',
          color: resetArmed ? '#f87171' : 'rgba(255,255,255,0.85)',
          cursor: 'pointer',
          padding: 5,
          marginRight: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
          transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
        } as React.CSSProperties}>
        {/* Refresh / loop icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>

      {/* Right group: minimize chevron immediately to the left of three-dot menu */}
      <div style={{
        display: 'flex', gap: 'var(--sp1)',
        alignItems: 'center',
        flexShrink: 0,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>

        {/* Minimize / expand — placed directly to the left of the three-dot menu */}
        <button
          onClick={onToggleMinimize}
          className="interactive"
          title={isMinimized ? 'Expand panel' : 'Minimize panel'}
          style={{
            background: 'none', border: 'none',
            color: '#ffffff', cursor: 'pointer',
            padding: '2px 4px', display: 'flex', alignItems: 'center',
          }}>
          {isMinimized
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          }
        </button>

        {/* Close (X) — hides the overlay; detector keeps running in tray.
            Same behavior as the previous "Hide overlay" menu item. Quit lives
            in the tray icon's right-click menu. */}
        <button
          onClick={() => (window as any).api?.annotated?.hide?.()}
          className="interactive"
          title="Hide overlay (detector keeps running in the tray)"
          style={{
            background: 'none', border: 'none',
            color: '#ffffff', cursor: 'pointer',
            padding: '2px 4px', display: 'flex', alignItems: 'center',
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6"  x2="6"  y2="18" />
            <line x1="6"  y1="6"  x2="18" y2="18" />
          </svg>
        </button>

      </div>
    </div>
    </>
  )
}
