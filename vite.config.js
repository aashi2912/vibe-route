import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Shared helper: call Anthropic Claude API
  async function callClaude(apiKey, prompt, maxTokens = 250) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  }

  // Shared helper: read POST body
  async function readBody(req) {
    let body = "";
    for await (const chunk of req) body += chunk;
    return body;
  }

  return {
    plugins: [
      react(),
      {
        name: "api-proxy",
        configureServer(server) {
          // ─── /api/narrative ───────────────────────────
          server.middlewares.use("/api/narrative", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              return res.end(JSON.stringify({ error: "Method not allowed" }));
            }

            const apiKey = env.LLM_API_KEY;
            if (!apiKey || apiKey === "your_anthropic_api_key_here") {
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ narrative: null, fallback: true }));
            }

            try {
              const { prompt } = JSON.parse(await readBody(req));
              const narrative = await callClaude(apiKey, prompt);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ narrative }));
            } catch (err) {
              console.error("Narrative proxy error:", err);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ narrative: null, fallback: true }));
            }
          });

          // ─── /api/parse-vibes (AI #2: NLP Input) ─────
          server.middlewares.use("/api/parse-vibes", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              return res.end(JSON.stringify({ error: "Method not allowed" }));
            }

            const apiKey = env.LLM_API_KEY;
            if (!apiKey || apiKey === "your_anthropic_api_key_here") {
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ vibes: null, fallback: true }));
            }

            try {
              const { text } = JSON.parse(await readBody(req));

              const prompt = `You are a route preference parser. The user described their ideal walk. Extract which vibes they want from this list:
- "green" = parks, trees, nature, quiet, peaceful, greenery
- "coffee" = cafes, coffee shops, coffee stops
- "local" = local shops, restaurants, character, culture, neighbourhood, explore, food
- "lit" = well-lit, safe, bright, busy streets (for night walks)

User's description: "${text}"

Respond with ONLY a JSON array of matching vibe IDs. Examples:
- "I want a quiet walk through parks" → ["green"]
- "Find me coffee shops and local food" → ["coffee", "local"]
- "Safe well-lit route with greenery" → ["green", "lit"]
- "Just explore the neighbourhood" → ["local"]

If nothing matches clearly, return ["green", "local"] as defaults.

JSON array:`;

              const result = await callClaude(apiKey, prompt, 50);

              let vibes = null;
              if (result) {
                try {
                  // Extract JSON array from response
                  const match = result.match(/\[.*\]/s);
                  if (match) {
                    vibes = JSON.parse(match[0]);
                    // Validate — only allow known vibe IDs
                    const valid = ["green", "coffee", "local", "lit"];
                    vibes = vibes.filter((v) => valid.includes(v));
                    if (vibes.length === 0) vibes = ["green", "local"];
                  }
                } catch {
                  vibes = ["green", "local"];
                }
              }

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ vibes }));
            } catch (err) {
              console.error("Parse vibes error:", err);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ vibes: null, fallback: true }));
            }
          });
        },
      },
    ],
  };
});
