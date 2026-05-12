'use client'
import { useState, useRef } from 'react'
import { Card, CitationPassage } from '@/types/overlay'
import { CitationTooltip } from './CitationTooltip'

const VERDICT_STYLES: Record<string, { color: string; bg: string }> = {
  CONFIRMED:   { color: 'var(--fc1)', bg: 'var(--fc2)' },
  CORRECTED:   { color: 'var(--vc1)', bg: 'var(--vc2)' },
  UNCONFIRMED: { color: 'var(--vu1)', bg: 'var(--vu2)' },
}

// Hostname → display label. Hostname is parsed from the URL (no substring
// matching — `url.includes('ap')` would falsely tag any URL containing
// "api"/"happen"/"map" as AP News, including the Vertex redirect path
// "grounding-api-redirect"). Suffix matching covers subdomains.
const HOST_LABELS: Record<string, string> = {
  'wikipedia.org':       'Wikipedia',
  'apnews.com':          'AP News',
  'ap.org':              'AP News',
  'reuters.com':         'Reuters',
  'afp.com':             'AFP',
  'bbc.com':             'BBC',
  'bbc.co.uk':           'BBC',
  'npr.org':             'NPR',
  'pbs.org':             'PBS',
  'cnn.com':             'CNN',
  'cbsnews.com':         'CBS',
  'nbcnews.com':         'NBC',
  'abcnews.go.com':      'ABC',
  'foxnews.com':         'Fox',
  'nytimes.com':         'NY Times',
  'washingtonpost.com':  'WaPo',
  'wsj.com':             'WSJ',
  'ft.com':              'FT',
  'bloomberg.com':       'Bloomberg',
  'cnbc.com':            'CNBC',
  'forbes.com':          'Forbes',
  'fortune.com':         'Fortune',
  'businessinsider.com': 'Insider',
  'theinformation.com':  'The Info',
  'economist.com':       'Economist',
  'theguardian.com':     'Guardian',
  'latimes.com':         'LA Times',
  'usatoday.com':        'USA Today',
  'thedailybeast.com':   'Daily Beast',
  'politico.com':        'Politico',
  'axios.com':           'Axios',
  'vox.com':             'Vox',
  'slate.com':           'Slate',
  'theatlantic.com':     'Atlantic',
  'time.com':            'TIME',
  'newsweek.com':        'Newsweek',
  'rollingstone.com':    'Rolling Stone',
  'vanityfair.com':      'Vanity Fair',
  'variety.com':         'Variety',
  'hollywoodreporter.com': 'THR',
  'deadline.com':        'Deadline',
  'techcrunch.com':      'TechCrunch',
  'theverge.com':        'The Verge',
  'arstechnica.com':     'Ars Technica',
  'wired.com':           'Wired',
  'engadget.com':        'Engadget',
  'protocol.com':        'Protocol',
  '404media.co':         '404 Media',
  'britannica.com':      'Britannica',
  'sec.gov':             'SEC',
  'pacer.gov':           'PACER',
  'courtlistener.com':   'CourtListener',
  'law.justia.com':      'Justia',
  'oyez.org':            'Oyez',
  'reddit.com':          'Reddit',
  'old.reddit.com':      'Reddit',
  'crunchbase.com':      'Crunchbase',
  'github.com':          'GitHub',
  'news.ycombinator.com':'HN',
  'stackoverflow.com':   'Stack Overflow',
  'twitter.com':         'X',
  'x.com':               'X',
  'youtube.com':         'YouTube',
  'youtu.be':            'YouTube',
  'substack.com':        'Substack',
  'medium.com':          'Medium',
  'producthunt.com':     'Product Hunt',
  'vertexaisearch.cloud.google.com': 'Source',
}

function labelForUrl(rawUrl: string): string {
  try {
    const u = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl
    const host = new URL(u).hostname.replace(/^www\./, '').toLowerCase()
    if (HOST_LABELS[host]) return HOST_LABELS[host]
    for (const [h, l] of Object.entries(HOST_LABELS)) {
      if (host.endsWith('.' + h)) return l
    }
    if (host.endsWith('.gov')) return host.split('.')[0].toUpperCase()
    if (host.endsWith('.edu')) return host.replace(/\.edu$/, '')
    return host
  } catch {
    return rawUrl.slice(0, 30)
  }
}

interface FCCardProps {
  card: Card
  isInline?: boolean
  showComments?: boolean
  onBookmark?: (id: string) => void
  onReact?: (id: string, type: 'agree' | 'question' | 'comment') => void
  onPublish?: (id: string) => void
  isPulsing?: boolean
  cardNumber?: number
  // Collapse state — older cards (3+ positions back) auto-render in a
  // compact bar to give the transcript more space. Hover expands; click
  // pins it expanded until clicked again.
  isCollapsed?: boolean
  isPinned?: boolean
  onTogglePin?: (cardId: string) => void
  onHoverChange?: (cardId: string, hovered: boolean) => void
}

export function FCCard({
  card, isInline, showComments, onBookmark, onReact, onPublish, isPulsing, cardNumber,
  isCollapsed, isPinned, onTogglePin, onHoverChange,
}: FCCardProps) {
  const [hoveredCitation, setHoveredCitation] = useState<{ url: string; rect: DOMRect } | null>(null)
  const anchorRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const vs = VERDICT_STYLES[card.verdict] ?? VERDICT_STYLES.UNCONFIRMED

  // Compact (collapsed) representation — small bar showing number + verdict
  // + first ~50 chars of fact. Click to pin-expand. Hover handled by parent.
  if (isCollapsed) {
    const snippet = (card.comment || card.triggerSentence || '').slice(0, 60)
    return (
      <div
        onClick={() => onTogglePin?.(card.id)}
        onMouseEnter={() => onHoverChange?.(card.id, true)}
        onMouseLeave={() => onHoverChange?.(card.id, false)}
        className={`glass-card${isPulsing ? ' card-pulse' : ''}`}
        style={{
          borderLeft: '2.5px solid var(--fc1)',
          margin: isInline ? 'var(--sp1) 0' : '0',
          padding: '4px 8px',
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer',
          minHeight: 26,
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color: 'var(--t2)',
          opacity: 0.78,
          transition: 'opacity .12s, padding .12s',
        }}
        title="Click to expand"
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 3, background: 'var(--fc1)', color: '#fff',
          fontSize: 10, fontWeight: 700,
        }}>{cardNumber ?? ''}</span>
        <span style={{
          color: vs.color, background: vs.bg,
          padding: '1px 5px', borderRadius: 'var(--r1)',
          fontWeight: 600, letterSpacing: '.08em', fontSize: 9,
        }}>{card.verdict}</span>
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
      className={`glass-card card-entrance${isPulsing ? ' card-pulse' : ''}`}
      style={{
        borderLeft: '2.5px solid var(--fc1)',
        margin: isInline ? 'var(--sp2) 0 var(--sp2) 0' : '0',
        padding: 'var(--sp3)',
        position: 'relative',
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
          background: 'var(--fc1)',
        }}>{cardNumber ?? ''}</span>
        <span style={{
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color: 'var(--t2)', letterSpacing: '.06em', flex: 1,
        }}>FACT CHECKER</span>
        <span style={{
          fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
          color: 'var(--t3)',
        }}>{card.elapsed}</span>
        <button
          onClick={() => onBookmark?.(card.id)}
          className="interactive"
          title={card.isBookmarked ? 'Remove bookmark' : 'Save this fact'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: card.isBookmarked ? 'var(--a1)' : 'var(--t3)',
            fontSize: 13, padding: '1px 3px',
          }}>{card.isBookmarked ? '🔖' : '🔖'}</button>
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

      {/* Verdict tag */}
      <div style={{
        display: 'inline-block',
        fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
        fontWeight: 600, letterSpacing: '.1em',
        color: vs.color, background: vs.bg,
        padding: '2px 6px', borderRadius: 'var(--r1)',
        marginBottom: 'var(--sp2)',
      }}>
        {card.verdict}
      </div>

      {/* Comment */}
      <p style={{
        fontFamily: 'var(--f-sans)', fontSize: 'var(--fs-md)',
        color: 'var(--t1)', margin: '0 0 var(--sp2) 0',
        lineHeight: 1.5,
      }}>
        {card.comment}
      </p>

      {/* Citations */}
      {card.citations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp1)', marginBottom: 'var(--sp2)' }}>
          {card.citations.map(url => {
            const label = labelForUrl(url)
            const tier = card.citationTiers?.[url]
            const isCommunity = tier === 'community'
            const passage = card.citationPassages?.[url]
            return (
              <div key={url}>
                <a
                  ref={el => { anchorRefs.current[url] = el }}
                  href={passage?.archiveUrl ?? url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="interactive"
                  onMouseEnter={() => {
                    const rect = anchorRefs.current[url]?.getBoundingClientRect() ?? new DOMRect()
                    setHoveredCitation({ url, rect })
                  }}
                  onMouseLeave={() => setHoveredCitation(null)}
                  style={{
                    fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
                    color: 'var(--fc1)', textDecoration: 'underline',
                    textUnderlineOffset: 2, letterSpacing: '.04em',
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                  {label} ↗
                </a>
                {hoveredCitation?.url === url && passage && (
                  <CitationTooltip passage={passage} anchorRect={hoveredCitation.rect} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reactions + Publish — track livestream reactions and comments */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp3)' }}>
        <button
          onClick={() => onReact?.(card.id, 'agree')}
          className="interactive"
          title="Agreed — fact stands"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
            color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <span style={{ fontSize: '1.5em', lineHeight: 1 }}>💯</span>{card.reactionsAgree > 0 ? ` · ${card.reactionsAgree}` : ''}
        </button>
        <button
          onClick={() => onReact?.(card.id, 'question')}
          className="interactive"
          title="Questioning this fact"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
            color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <span style={{ fontSize: '1.5em', lineHeight: 1 }}>🤔</span>{card.reactionsQuestion > 0 ? ` · ${card.reactionsQuestion}` : ''}
        </button>
        <button
          onClick={() => onReact?.(card.id, 'comment')}
          className="interactive"
          title="Livestream comments on this fact"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
            color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <span style={{ fontSize: '1.5em', lineHeight: 1 }}>💬</span>{(card.reactionsComment ?? 0) > 0 ? ` · ${card.reactionsComment}` : ''}
        </button>
        {onPublish && (
          card.isPublished ? (
            <span style={{
              marginLeft: 'auto',
              fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
              color: 'var(--t3)', letterSpacing: '.06em',
            }}>✓ PUBLISHED</span>
          ) : (
            <button
              onClick={() => onPublish(card.id)}
              className="interactive"
              title="post to anotated.com profile"
              style={{
                marginLeft: 'auto',
                background: 'var(--a4)', border: '1px solid var(--a1)',
                borderRadius: 'var(--r2)', cursor: 'pointer',
                fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-xs)',
                color: 'var(--a1)', padding: '2px 8px', letterSpacing: '.06em',
              }}>
              ◆ PUBLISH
            </button>
          )
        )}
      </div>
    </div>
  )
}
