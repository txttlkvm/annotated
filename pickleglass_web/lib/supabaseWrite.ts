/**
 * All Supabase writes are fire-and-forget.
 * If NEXT_PUBLIC_SUPABASE_URL is not set, every function no-ops silently.
 */
import { getSupabase } from './supabase'
import type { Card } from '@/types/overlay'

const db = () => getSupabase()

// ── Sessions ──────────────────────────────────────────────────────────────

export async function createSession(speaker: string): Promise<string | null> {
  const sb = db()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('annotated_sessions')
      .insert({ speaker, title: `Session — ${speaker}`, started_at: new Date().toISOString() })
      .select('id')
      .single()
    if (error) throw error
    return data.id as string
  } catch (e) {
    console.warn('[supabase] createSession failed', e)
    return null
  }
}

export async function endSession(sessionId: string): Promise<void> {
  const sb = db()
  if (!sb || !sessionId) return
  try {
    await sb
      .from('annotated_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
  } catch (e) {
    console.warn('[supabase] endSession failed', e)
  }
}

export async function setSessionPublic(sessionId: string, isPublic: boolean): Promise<void> {
  const sb = db()
  if (!sb || !sessionId) return
  try {
    await sb
      .from('annotated_sessions')
      .update({ is_public: isPublic })
      .eq('id', sessionId)
  } catch (e) {
    console.warn('[supabase] setSessionPublic failed', e)
  }
}

// ── Cards ─────────────────────────────────────────────────────────────────

export async function writeCard(sessionId: string | null, card: Card): Promise<string | null> {
  const sb = db()
  if (!sb || !sessionId) return null
  try {
    const { data, error } = await sb
      .from('annotated_cards')
      .insert({
        session_id: sessionId,
        type: card.type,
        verdict: card.verdict,
        comment: card.comment,
        citations: card.citations,
        trigger_sentence: card.triggerSentence,
        elapsed: card.elapsed,
        timestamp: card.timestamp,
        reactions_agree: card.reactionsAgree,
        reactions_question: card.reactionsQuestion,
        is_bookmarked: card.isBookmarked ?? false,
        is_published: false,
      })
      .select('id')
      .single()
    if (error) throw error
    // Increment session card_count (best-effort)
    void sb.rpc('increment_card_count', { session_id: sessionId })
    return data.id as string
  } catch (e) {
    console.warn('[supabase] writeCard failed', e)
    return null
  }
}

export async function updateCardReactions(
  supabaseId: string,
  reactionsAgree: number,
  reactionsQuestion: number
): Promise<void> {
  const sb = db()
  if (!sb || !supabaseId) return
  try {
    await sb
      .from('annotated_cards')
      .update({ reactions_agree: reactionsAgree, reactions_question: reactionsQuestion })
      .eq('id', supabaseId)
  } catch (e) {
    console.warn('[supabase] updateCardReactions failed', e)
  }
}

export async function updateCardBookmark(supabaseId: string, isBookmarked: boolean): Promise<void> {
  const sb = db()
  if (!sb || !supabaseId) return
  try {
    await sb
      .from('annotated_cards')
      .update({ is_bookmarked: isBookmarked })
      .eq('id', supabaseId)
  } catch (e) {
    console.warn('[supabase] updateCardBookmark failed', e)
  }
}

export async function publishCard(supabaseId: string): Promise<void> {
  const sb = db()
  if (!sb || !supabaseId) return
  try {
    await sb
      .from('annotated_cards')
      .update({ is_published: true })
      .eq('id', supabaseId)
  } catch (e) {
    console.warn('[supabase] publishCard failed', e)
  }
}
