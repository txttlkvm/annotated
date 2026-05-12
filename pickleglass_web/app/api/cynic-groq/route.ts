// Groq Llama 3.3 70B for Cynic — sub-200ms, no search needed.
// edge runtime removed — deployed via Electron backend proxy, not Vercel edge

export async function POST(req: Request) {
  const { system, context, newChunk, maxTokens } = await req.json()

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'GROQ_API_KEY not set', text: '~' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Context (recent conversation):\n${context}\n\nNew segment to evaluate:\n${newChunk}`,
          },
        ],
        temperature: 0.4,
        max_tokens: maxTokens ?? 200,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return Response.json({ error: err, text: '~' }, { status: res.status })
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim() ?? '~'
    return Response.json({ text })
  } catch (err) {
    console.error('[cynic-groq]', err)
    return Response.json({ error: String(err), text: '~' }, { status: 500 })
  }
}
