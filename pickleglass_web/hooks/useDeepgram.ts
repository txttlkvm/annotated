import { DEEPGRAM_CONFIG } from '../lib/deepgram'

export function connectDeepgram(
  onInterim: (text: string, speaker: number) => void,
  onFinal: (text: string, speaker: number) => void
): WebSocket {
  const params = new URLSearchParams(
    (Object.entries(DEEPGRAM_CONFIG) as [string, unknown][]).flatMap(([k, v]) =>
      Array.isArray(v)
        ? v.map((kw: string) => [k, kw] as [string, string])
        : [[k, String(v)] as [string, string]]
    )
  )

  const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY
  if (!apiKey) {
    throw new Error('[useDeepgram] NEXT_PUBLIC_DEEPGRAM_API_KEY is not set')
  }

  const ws = new WebSocket(
    `wss://api.deepgram.com/v1/listen?${params}`,
    ['token', apiKey]
  )

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.type !== 'Results') return
    const transcript = data.channel?.alternatives?.[0]?.transcript ?? ''
    const speaker = data.channel?.alternatives?.[0]?.words?.[0]?.speaker ?? 0
    if (!transcript.trim()) return
    if (data.is_final) onFinal(transcript, speaker)
    else onInterim(transcript, speaker)
  }

  ws.onerror = (e) => console.error('[useDeepgram] WebSocket error', e)
  ws.onclose = (e) => console.log('[useDeepgram] WebSocket closed', e.code, e.reason)

  return ws
}
