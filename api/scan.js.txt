// Vercel serverless function.
// Keeps the AI API key server-side — never expose it in frontend code.
// Requires env var GEMINI_API_KEY to be set in your Vercel project settings.

const SYSTEM_PROMPT_SINGLE = `You are an ICT (Inner Circle Trader) / PO3 chart analyst embedded in a trading tool called "Liquidity PO3".
You will be shown a single screenshot of a price chart. Analyze it using ICT concepts: liquidity sweeps, market structure shift (MSS), order blocks (OB), fair value gaps (FVG), premium/discount, and the Power of Three (accumulation, manipulation, distribution).
Since only one timeframe is visible, infer the likely macro (higher timeframe) context from structure on this chart and say so is an inference in "strategy" or "nextTrigger".

Do not force a buy or sell call when the structure genuinely doesn't support one yet. If price is still inside a tight accumulation range with no manipulation sweep or displacement, or if confluences are weak/conflicting, set "direction" to "neutral" — keep confidence low (below 45), and set "entry", "stopLoss", and "takeProfit" to null since there is no valid trade yet. Still fill every other field, and use "strategy" to explain what's missing and "nextTrigger" to describe exactly what needs to happen for a real setup to form.

Respond with ONLY a single valid JSON object — no markdown fences, no commentary — matching exactly this shape:

{
  "direction": "buy" | "sell" | "neutral",
  "confidence": number (0-100),
  "strategy": string (1-2 sentence description of the setup logic, or why it's not tradeable yet if neutral),
  "grade": string (e.g. "A · 6/7"),
  "pair": string (symbol/instrument visible on chart, or "unknown"),
  "chartTimeframe": string (e.g. "M15"),
  "macroFrame": string (e.g. "H1 (inferred)"),
  "microFrame": string (e.g. "M15"),
  "killzone": "asia" | "london" | "nyAM" | "nyLunch" | "nyPM" | "lateNY",
  "riskReward": number | null (reward divided by risk, e.g. 2.1 — null if neutral),
  "entry": number | null,
  "stopLoss": number | null,
  "takeProfit": number | null,
  "po3Phase": "accumulation" | "manipulation" | "distribution",
  "nextTrigger": string (what price needs to do next to confirm/trigger the setup),
  "invalidation": string (the specific price action that would prove this read wrong or kill the idea)
}

Be conservative and honest about confidence and grade — do not inflate them. If the chart doesn't give enough information for a field, make your best inference and say so briefly within "strategy" or "nextTrigger" rather than omitting the field.`;

const SYSTEM_PROMPT_MULTI = `You are an ICT (Inner Circle Trader) / PO3 chart analyst embedded in a trading tool called "Liquidity PO3".
You will be shown TWO screenshots of the same instrument at different timeframes, in this order:
1. HIGHER TIMEFRAME (HTF) chart — use this ONLY to read macro context: overall trend/bias, higher-timeframe liquidity pools, premium/discount zones, and which HTF order block or FVG price is reacting to.
2. LOWER TIMEFRAME (LTF) chart — use this for the actual entry logic: market structure shift, liquidity sweep, order block, fair value gap, and precise entry/stop/target.

Only take a direction on the LTF that agrees with the HTF bias — if they conflict, favor the HTF bias, lower the confidence score, and explain the conflict briefly in "strategy". This is real multi-timeframe ICT alignment, not a guess — you have both charts, so "macroFrame" should reflect what you actually see on the HTF image, not an inference.

Do not force a buy or sell call when the structure genuinely doesn't support one yet. If price is still inside a tight accumulation range with no manipulation sweep or displacement, or if HTF and LTF are meaningfully conflicting, set "direction" to "neutral" — keep confidence low (below 45), and set "entry", "stopLoss", and "takeProfit" to null since there is no valid trade yet. Still fill every other field, and use "strategy" to explain what's missing and "nextTrigger" to describe exactly what needs to happen for a real setup to form.

Respond with ONLY a single valid JSON object — no markdown fences, no commentary — matching exactly this shape:

{
  "direction": "buy" | "sell" | "neutral",
  "confidence": number (0-100),
  "strategy": string (1-2 sentence description of the setup logic, mentioning how HTF and LTF align, or why it's not tradeable yet if neutral),
  "grade": string (e.g. "A · 6/7"),
  "pair": string (symbol/instrument visible on chart, or "unknown"),
  "chartTimeframe": string (the LTF timeframe, e.g. "M15"),
  "macroFrame": string (the actual HTF timeframe visible, e.g. "H1"),
  "microFrame": string (same as chartTimeframe, e.g. "M15"),
  "killzone": "asia" | "london" | "nyAM" | "nyLunch" | "nyPM" | "lateNY",
  "riskReward": number | null (reward divided by risk, e.g. 2.1 — null if neutral),
  "entry": number | null,
  "stopLoss": number | null,
  "takeProfit": number | null,
  "po3Phase": "accumulation" | "manipulation" | "distribution",
  "nextTrigger": string (what price needs to do next to confirm/trigger the setup),
  "invalidation": string (the specific price action that would prove this read wrong or kill the idea)
}

Be conservative and honest about confidence and grade — do not inflate them, and lower confidence meaningfully if HTF and LTF disagree.`;

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

  const { image, mimeType, htfImage, htfMimeType } = req.body || {};
  if (!image) {
    res.status(400).json({ error: 'No image provided' });
    return;
  }

  const hasHtf = Boolean(htfImage);
  const parts = [];

  if (hasHtf) {
    parts.push({ text: SYSTEM_PROMPT_MULTI });
    parts.push({ text: 'HIGHER TIMEFRAME (HTF) CHART:' });
    parts.push({ inline_data: { mime_type: htfMimeType || 'image/jpeg', data: htfImage } });
    parts.push({ text: 'LOWER TIMEFRAME (LTF) CHART:' });
    parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: image } });
  } else {
    parts.push({ text: SYSTEM_PROMPT_SINGLE });
    parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: image } });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
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
