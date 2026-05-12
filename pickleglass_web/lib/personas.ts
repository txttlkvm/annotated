import { FACT_CHECKER_SYSTEM, CYNIC_SYSTEM } from './prompts'
import { getBuffer } from './buffer'
import { SILENCE_GATE } from './deepgram'

// Resolves with the first non-null value from the array of promises.
// Falls back through remaining promises if earlier ones resolve null.
function raceValid(promises: Promise<string | null>[]): Promise<string | null> {
  return new Promise(resolve => {
    let remaining = promises.length
    promises.forEach(p =>
      p.then(val => {
        if (val) resolve(val)
        else if (--remaining === 0) resolve(null)
      }).catch(() => { if (--remaining === 0) resolve(null) })
    )
  })
}

// FC: Gemini 2.5 Flash with Google Search grounding (real-time facts).
// Returns the raw text PLUS the grounded URLs Google actually returned, which
// we use to filter out hallucinated SOURCES lines in the model's text response.
async function callFC(context: string, newChunk: string): Promise<{ text: string; groundedUrls: string[] }> {
  // Current date so the model can resolve vague time refs ("this weekend",
  // "yesterday", "last month") into concrete date ranges for grounded search.
  // Without this, "incident at the WH dinner this weekend" gets searched as
  // generic WHCA dinner content and misses the actual shooting.
  const today = new Date()
  const todayStr = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const dateContext = `Today is ${todayStr}. Use this to resolve "this weekend", "yesterday", "last week" etc. into specific dates when searching.`
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `${FACT_CHECKER_SYSTEM}\n\n${dateContext}\n\nContext (recent conversation):\n${context}\n\nNew segment to evaluate:\n${newChunk}`,
      maxTokens: SILENCE_GATE.FC_MAX_TOKENS,
      useSearch: true,
    }),
  })
  const data = await res.json()
  return { text: data.text ?? '~', groundedUrls: data.groundedUrls ?? [] }
}

// Cynic: Groq + Gemini fire in parallel — use whichever responds first with a valid result.
// Groq wins ~150ms most of the time; Gemini is already in flight as backup.
// FC stays Gemini-only because it needs Search grounding for real citations.
async function callCynic(context: string, newChunk: string): Promise<string> {
  const groqPromise = fetch('/api/cynic-groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: CYNIC_SYSTEM,
      context,
      newChunk,
      maxTokens: SILENCE_GATE.CYNIC_MAX_TOKENS,
    }),
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`Groq ${r.status}`)))
    .then(d => (d.text && d.text !== '~') ? d.text : Promise.reject(new Error('Groq empty')))
    .catch(err => { console.warn('[personas] Groq cynic:', err.message); return null })

  const geminiPromise = fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `${CYNIC_SYSTEM}\n\nContext (recent conversation):\n${context}\n\nNew segment to evaluate:\n${newChunk}`,
      maxTokens: SILENCE_GATE.CYNIC_MAX_TOKENS,
      useSearch: false,
    }),
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`Gemini ${r.status}`)))
    .then(d => (d.text && d.text !== '~') ? d.text : Promise.reject(new Error('Gemini empty')))
    .catch(err => { console.warn('[personas] Gemini cynic:', err.message); return null })

  // Race: first non-null result wins; if that fails, use the other. Both are already in flight.
  return await raceValid([groqPromise, geminiPromise]) ?? '~'
}

export async function firePersonas(sentence: string): Promise<{
  fc: string | null
  cynic: string | null
  groundedUrls?: string[]
}> {
  const context = getBuffer()

  // Cynic disabled — only the Fact Checker fires. Iterating without Cynic
  // to see if FC carries the experience alone; re-enable by swapping the
  // null back to `callCynic(context, sentence)`.
  const [fcResult, cynic] = await Promise.all([
    callFC(context, sentence),
    Promise.resolve<string | null>(null),
  ])

  return {
    fc: !fcResult.text || fcResult.text.trim() === '~' ? null : fcResult.text,
    cynic: !cynic || cynic.trim() === '~' ? null : cynic,
    groundedUrls: fcResult.groundedUrls,
  }
}
