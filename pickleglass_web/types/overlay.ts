export type Verdict = 'CONFIRMED' | 'CORRECTED' | 'UNCONFIRMED' | 'FRAMING'

export interface CitationPassage {
  passage: string
  title?: string
  archiveUrl?: string
  archiveDate?: string
  type: 'wayback' | 'tweet' | 'direct' | 'synthesis'
}

export interface Card {
  id: string
  type: 'fc' | 'cynic'
  verdict: Verdict
  comment: string
  citations: string[]
  // Per-URL tier: 'primary' (★) = AP/Reuters/SEC/.gov/.edu/X — verdict can be
  // CONFIRMED/CORRECTED. 'community' (✱) = Reddit/Crunchbase/TechCrunch/etc —
  // verdict capped at UNCONFIRMED with asterisk badge on the citation.
  citationTiers?: Record<string, 'primary' | 'community'>
  elapsed: string        // "01:14:32"
  timestamp: number
  triggerSentence: string
  triggerLineId: string
  reactionsAgree: number
  reactionsQuestion: number
  reactionsComment?: number   // count of livestream comments on this card
  supabaseId?: string
  citationPassages: Record<string, CitationPassage>
  isBookmarked?: boolean
  isPublished?: boolean
  isManual?: boolean   // filed via "File a Claim" input
  fallacyLabel?: string  // cynic cards: short fallacy label for badge
  counter?: string       // cynic cards: the opposing view / counterexample
}

export interface TranscriptLine {
  id: string
  speaker: string        // "JASON", "LON", "SPEAKER_0"
  speakerId?: number     // numeric diarization id (0=Me, 1=Them, 10+=diarized)
  text: string
  isFinal: boolean
  timestamp: number
  isFCTrigger?: boolean
  isCynicTrigger?: boolean
  cardIds: string[]
}

export interface TickMark {
  id: string
  type: 'fc' | 'cynic' | 'bookmarked'
  timestamp: number
  cardId: string
  comment: string
  triggerSentence: string
  elapsed: string
}
