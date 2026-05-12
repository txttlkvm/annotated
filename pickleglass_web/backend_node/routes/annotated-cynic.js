// POST /api/cynic-groq — Groq Llama 3.3 70B for cynic persona
const router = require('express').Router();

router.post('/', async (req, res) => {
  const { system, context, newChunk, maxTokens = 200 } = req.body;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set', text: '~' });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err, text: '~' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? '~';
    return res.json({ text });
  } catch (err) {
    console.error('[annotated-cynic]', err);
    return res.status(500).json({ error: String(err), text: '~' });
  }
});

module.exports = router;
