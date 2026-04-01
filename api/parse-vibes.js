/**
 * Vercel Serverless Function — Parse Vibes from Natural Language
 * AI #2: Natural Language Route Requests
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ vibes: null, fallback: true });
  }

  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const prompt = `You are a route preference parser. The user described their ideal walk. Extract which vibes they want from this list:
- "green" = parks, trees, nature, quiet, peaceful, greenery
- "coffee" = cafes, coffee shops, coffee stops
- "local" = local shops, restaurants, character, culture, neighbourhood, explore, food
- "lit" = well-lit, safe, bright, busy streets (for night walks)

User's description: "${text}"

Respond with ONLY a JSON array of matching vibe IDs. If nothing matches clearly, return ["green", "local"] as defaults.

JSON array:`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 50,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return res.status(200).json({ vibes: ["green", "local"], fallback: true });
    }

    const data = await response.json();
    const result = data.content?.[0]?.text || "";

    let vibes = ["green", "local"];
    try {
      const match = result.match(/\[.*\]/s);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const valid = ["green", "coffee", "local", "lit"];
        vibes = parsed.filter((v) => valid.includes(v));
        if (vibes.length === 0) vibes = ["green", "local"];
      }
    } catch {}

    return res.status(200).json({ vibes });
  } catch (error) {
    console.error("Parse vibes error:", error);
    return res.status(200).json({ vibes: ["green", "local"], fallback: true });
  }
}
