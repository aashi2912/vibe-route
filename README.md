# Vibe Route

**Walk the way that feels right.**

An AI-powered walking route comparison tool that scores routes by how they *feel* — greenery, coffee stops, local character — not just how fast they are.

**[Try it live →](https://vibe-route.vercel.app)**

---

## Why This Exists

Google Maps optimizes for speed. But pedestrian research consistently shows walkers choose longer routes when they're greener, safer, or more interesting.

In June 2024, a former Google Maps Senior UX Researcher [publicly explained](https://www.tomsguide.com/phones/google-pixel-phones/google-maps-may-not-offer-scenic-routes-because-it-could-be-too-biased) why Google won't add scenic routing — scoring routes on "niceness" would systematically bias toward affluent neighbourhoods. He confirmed the feature is "technically entirely feasible." The barrier is design, not engineering.

Vibe Route is my answer to that design challenge: score walking routes using objective, measurable signals instead of subjective "beauty" — and let users define what matters to them.

---

## How It Works

```
User Input → Routes API (alternatives) → Overlap Check → Waypoint Injection
→ Places API (POI scoring) → Vibe Scorer → LLM Narratives → Ranked Display
```

1. User enters origin, destination, and vibe preferences (or describes their ideal walk in natural language)
2. Google Routes API returns walking alternatives; system checks street overlap
3. If routes overlap >70%, ML clustering discovers "vibe zones" and generates additional routes through them
4. Each route is scored by querying for parks, cafes, restaurants along the polyline
5. An LLM generates a 2–3 sentence narrative per route from verified POI data
6. Routes are ranked by the user's selected vibes and displayed with scores, narratives, and POI pills

---

## AI Components

### AI #1: Auto Waypoint Discovery — *ML Clustering*
Google's walking alternatives often share 70–100% of the same streets. A DBSCAN-inspired spatial clustering algorithm discovers POI-dense areas ("vibe zones") between origin and destination and generates genuinely different routes through them. This is what makes the product work globally without manual curation per city.

### AI #2: Natural Language Input — *LLM Parsing*
Users can type "quiet walk through parks with coffee stops" instead of tapping vibe chips. An LLM parses the natural language into structured vibe parameters. The chips update automatically.

### AI #3: Route Narratives — *LLM Generation*
Transforms route data into human-readable descriptions: *"This 4km walk takes you through downtown, past HOTHOUSE and The Berczy Tavern..."* Anti-hallucination design: the prompt constrains the LLM to only mention POIs confirmed by the Places API. A fallback template takes over if the LLM is unavailable. The app works without AI.

### AI #4: Vibe Scoring Engine — *Density Algorithms*
Logarithmic density-based scoring that measures POIs per kilometre with diminishing returns. Formula: `5 × (1 − e^(−density/k))`. Replaced an initial linear formula that maxed every downtown route at 5/5.

### What I Rejected
- **AI personalization** — not enough users for meaningful training data
- **LLM scenic scoring** — would encode the exact affluence bias the Klimes controversy warned about
- **AI soundtrack recommendations** — feature creep

---

## Research Foundation

Six peer-reviewed studies shaped the product design:

| Study | Key Finding | Design Impact |
|---|---|---|
| Nanjing GPS Study (2023) | Leisure walkers take paths ~25% longer than shortest | Set 30% detour cap for waypoint injection |
| Chicago GPS Study (2025) | Pedestrians prefer parks, sky visibility, amenities | Defined vibe scoring dimensions |
| Portland GPS Study (2010–2013) | 1,167 walk trips — detours for attractive facilities | Validated waypoint injection approach |
| Sejong City CPTED Study (2020) | 2× more female students feel unsafe at night | Created Night Walker persona |
| Sustainable Cities & Society (2023) | Female pedestrians avoid poorly-lit routes | Prioritized Well-Lit feature (v2) |
| BYU Heat Map Study (2024) | Women focus on peripheral safety hazards at night | Informed night-mode scoring weights |

---

## Bias Framework

The Klimes concern is legitimate. Scoring routes on "niceness" biases toward wealthy neighbourhoods. The product addresses this with four principles:

1. **Objective signals** — park proximity, POI density, road type — not subjective "beauty"
2. **User-defined vibes** — the system doesn't decide what's "good"
3. **Income correlation testing** — planned: 50 routes across diverse neighbourhoods, correlate scores with census data
4. **Local discovery as positive** — diverse independent shops score as high "local character," rewarding neighbourhood diversity

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Maps | Google Maps JavaScript API |
| Routing | Google Routes API (walking + alternatives) |
| POI Data | Google Places API (New) + Places API (legacy for Autocomplete) |
| AI Narratives | Anthropic Claude Haiku (via server-side proxy) |
| Hosting | Vercel (static + serverless functions) |
| Cost | $5–22 total to build and launch |

---

## Project Structure

```
vibe-route/
├── src/
│   ├── App.jsx                        # Screen routing + state
│   ├── screens/
│   │   ├── InputScreen.jsx            # Origin/dest + vibes + NLP input
│   │   ├── ResultsScreen.jsx          # Map + route cards + progressive loading
│   │   └── DetailScreen.jsx           # Full route detail view
│   ├── services/
│   │   ├── routeOrchestrator.js       # Pipeline: routes → waypoints → scoring → narratives
│   │   ├── routesApi.js               # Google Routes API integration
│   │   ├── placesApi.js               # Google Places API with caching
│   │   ├── waypointEngine.js          # AI #1: ML clustering for waypoint discovery
│   │   ├── vibeScorer.js              # AI #4: Logarithmic density scoring
│   │   └── narrativeGenerator.js      # AI #3: LLM narratives with anti-hallucination
│   └── utils/
│       ├── geo.js                     # Polyline decoder, haversine, sampling, sunset calc
│       └── constants.js               # Vibe definitions, API config, scoring parameters
├── api/
│   ├── narrative.js                   # Vercel serverless: LLM narrative proxy
│   └── parse-vibes.js                 # Vercel serverless: NLP vibe parsing proxy
├── index.html                         # Entry point + Google Maps script
├── vite.config.js                     # Dev server with API proxy middleware
├── tailwind.config.js                 # Custom theme (earth tones, night mode)
└── package.json
```

---

## Setup

### Prerequisites

- Node.js 18+
- Google Cloud project with billing enabled
- (Optional) Anthropic API key for AI narratives

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/vibe-route.git
cd vibe-route
npm install
```

### 2. Enable Google APIs

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Library, enable:

- **Maps JavaScript API** — displays the map
- **Routes API** — fetches walking directions
- **Places API (New)** — POI search for scoring
- **Places API** (legacy) — required by Autocomplete widget

Create an API key in Credentials. Restrict by HTTP referrer: `http://localhost:5173/*` and your production domain.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_GOOGLE_MAPS_KEY=your_google_maps_api_key
LLM_API_KEY=your_anthropic_api_key  # optional — app works without it
```

Also replace `YOUR_API_KEY_HERE` in `index.html` with your Google Maps key.

### 4. Run

```bash
npm run dev
```

Open `http://localhost:5173`

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Set environment variables in Vercel dashboard: `VITE_GOOGLE_MAPS_KEY` and `LLM_API_KEY`.

---

## Features

- **Route comparison** — 3–4 walking routes with genuinely different paths
- **Vibe scoring** — Green & Peaceful, Coffee Stops, Local Character (Well-Lit in v2)
- **AI narratives** — LLM-generated descriptions from verified POI data
- **Natural language input** — "quiet walk through parks with coffee"
- **Day/night mode** — auto-detected with manual override
- **Progressive loading** — routes appear first, scores fill in, narratives load last
- **Waypoint injection** — ML clustering generates routes through interesting areas
- **POI deduplication** — each route card shows unique places
- **Google Maps deep link** — open selected route in Google Maps for navigation
- **Mobile responsive** — adaptive map height, constrained card width

---

## v2 Roadmap

- **Street View Computer Vision** — semantic segmentation (DeepLabV3+) on Street View images for Green View Index. Based on MIT's Treepedia research.
- **Well-Lit Scoring** — city streetlight dataset processing, starting with Toronto Open Data.
- **Bias Audit** — 50 routes across diverse neighbourhoods, correlate scores with census income data.
- **Community Layer** — user-submitted route ratings (raises moderation + privacy considerations).

---

## Background

Built as an AI Product Manager portfolio project. The full case study — including the Klimes controversy, research analysis, bias framework, technical decisions, and honest reflections on what I cut and why — is available as a PDF in the project.

**Author:** Aashi Thakkar
**Timeline:** 5 weeks from research to deployed product
**Target companies:** Google, Notion, Microsoft, Spotify, Uber, Netflix, Pinterest

---

## License

MIT
