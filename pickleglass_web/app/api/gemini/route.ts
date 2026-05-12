// edge runtime removed — deployed via Electron backend proxy, not Vercel edge
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  const { prompt, maxTokens, useSearch = false } = await req.json()

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })
  }

  const genAI = new GoogleGenerativeAI(apiKey)

  const PRIMARY_MODEL = 'gemini-2.5-flash'
  const FALLBACK_MODEL = 'gemini-2.5-flash-lite'

  function buildModel(modelName: string) {
    const cfg: Record<string, unknown> = {
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: maxTokens ?? 300,
      },
    }
    if (useSearch) cfg.tools = [{ googleSearch: {} }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return genAI.getGenerativeModel(cfg as any)
  }

  async function tryGenerate(modelName: string): Promise<string | null> {
    try {
      const result = await buildModel(modelName).generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })
      return result.response.text().trim()
    } catch (err) {
      console.warn(`[gemini route] ${modelName} failed:`, String(err).slice(0, 200))
      return null
    }
  }

  try {
    const text = await tryGenerate(PRIMARY_MODEL) ?? await tryGenerate(FALLBACK_MODEL)
    if (!text) return Response.json({ error: 'both models failed', text: '~' }, { status: 500 })
    return Response.json({ text })
  } catch (err) {
    console.error('[gemini route] unexpected:', err)
    return Response.json({ error: String(err), text: '~' }, { status: 500 })
  }
}
