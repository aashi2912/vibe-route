/**
 * Vercel Serverless Function — LLM Narrative Proxy
 *
 * Production version. Keeps the Anthropic API key server-side.
 * Set LLM_API_KEY in Vercel Environment Variables.
 *
 * In local dev, the Vite config middleware handles this endpoint instead.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ narrative: null, fallback: true });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status);
      return res.status(200).json({ narrative: null, fallback: true });
    }

    const data = await response.json();
    const narrative = data.content?.[0]?.text || null;

    return res.status(200).json({ narrative });
  } catch (error) {
    console.error("Narrative error:", error);
    return res.status(200).json({ narrative: null, fallback: true });
  }
}
