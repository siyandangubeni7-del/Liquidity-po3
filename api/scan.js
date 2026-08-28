// Vercel serverless function.
// Keeps the AI API key server-side — never expose it in frontend code.
// Requires env var GEMINI_API_KEY to be set in your Vercel project settings.

const SYSTEM_PROMPT = `You are an ICT (Inner Circle Trader) / PO3 chart analyst embedded in a trading tool called "Liquidity PO3".
You will be shown a screenshot of a price chart. Analyze it using ICT concepts: liquidity sweeps, market structure shift (MSS), order blocks (OB), fair value gaps (FVG), premium/discount, and the Power of Three (accumulation, manipulation, distribution).

Respond with ONLY a single valid JSON object — no markdown fences, no commentary — matching exactly this shape:

{
  "direction": "buy" | "sell",
  "confidence": number (0-100),
  "strategy": string (1-2 sentence description of the setup logic),
  "grade": string (e.g. "A · 6/7"),
  "pair": string (symbol/instrument visible on chart, or "unknown"),
  "chartTimeframe": string (e.g. "M15"),
  "macroFrame": string (e.g. "H1 (inferred)"),
  "microFrame": string (e.g. "M15"),
  "killzone": "asia" | "london" | "nyAM" | "nyLunch" | "nyPM" | "lateNY",
  "riskReward": number (reward divided by risk, e.g. 2.1),
  "entry": number,
  "stopLoss": number,
  "takeProfit": number,
  "po3Phase": "accumulation" | "manipulation" | "distribution",
  "nextTrigger": string (what price needs to do next to confirm/trigger the setup)
}

Be conservative and honest about confidence and grade — do not inflate them. If the chart doesn't give enough information for a field, make your best inference and say so briefly within "strategy" or "nextTrigger" rather than omitting the field.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in your Vercel project settings.' });
    return;
  }

  const { image, mimeType } = req.body || {};
  if (!image) {
    res.status(400).json({ error: 'No image provided' });
    return;
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: SYSTEM_PROMPT },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: image } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      res.status(502).json({ error: `AI API error: ${errText.slice(0, 300)}` });
      return;
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: 'AI returned no analysis. Try a clearer screenshot.' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      res.status(502).json({ error: 'AI response was not valid JSON.' });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
