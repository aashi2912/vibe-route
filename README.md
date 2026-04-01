# Vibe Route

**Walk the way that feels right.**

Compare walking routes by how they *feel* — greenery, safety, coffee stops, local character — not just how fast they are.

Built as an AI Product Manager portfolio project. Uses computer vision, ML clustering, and LLM generation to solve a real gap in Google Maps.

## Quick Start

### Prerequisites
- Node.js 18+ 
- A Google Cloud project with these APIs enabled:
  - **Routes API**
  - **Places API (New)**
  - **Maps JavaScript API**
- A Google Maps API key (restricted by HTTP referrer)

### Setup

```bash
# 1. Clone or download this project
cd vibe-route

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
# Edit .env and add your Google Maps API key

# 4. Start development server
npm run dev
```

### Google Cloud Setup (5 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Go to **APIs & Services → Library**
4. Enable these three APIs:
   - Routes API
   - Places API (New)  
   - Maps JavaScript API
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → API Key**
7. Click on the new key → **Restrict Key**:
   - Application restrictions: **HTTP referrers**
   - Add: `http://localhost:*` and your production domain
8. Copy the key to your `.env` file as `VITE_GOOGLE_MAPS_KEY`

### Important: Load the Maps JavaScript API

Add this to `index.html` before the `</head>` tag, replacing YOUR_KEY:

```html
<script async
  src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&libraries=places&callback=Function.prototype">
</script>
```

Or use the `@googlemaps/js-api-loader` package (already in dependencies):

```javascript
import { Loader } from '@googlemaps/js-api-loader';

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  libraries: ['places'],
});

await loader.load();
```

## Development Roadmap

| Week | Focus | Status |
|------|-------|--------|
| 1 | Foundation + Route Engine | 🔨 Current |
| 2 | Waypoint Engine + Vibe Scoring | ⏳ |
| 3 | AI Narratives + Full UI | ⏳ |
| 4 | Polish + Mobile + Edge Cases | ⏳ |
| 5 | Launch + Case Study | ⏳ |

## Architecture

```
User Input → Routes API (alternatives) → Waypoint Injection → 
Places API (POI scoring) → Vibe Scorer → LLM Narrative → Display
```

## AI Components

1. **Auto Waypoint Discovery (ML clustering)** — Discovers walkable neighborhoods from POI data
2. **LLM Route Narratives** — Transforms route data into human-readable descriptions
3. **Street View Greenery Analysis (v2)** — Computer vision on Street View images

## Research Foundation

Built on peer-reviewed pedestrian route choice research:
- Nanjing GPS study (2023): walkers take paths ~25% longer than shortest
- Chicago GPS study (2025): pedestrians prefer parks, sky visibility, amenities
- Sejong City CPTED study (2020): gendered safety gap in nighttime walking
- Portland GPS study (2010-2013): 1,167 walk trips analyzed for route preferences

## Bias Framework

Addresses the [Klimes controversy](https://www.tomsguide.com/phones/google-pixel-phones/google-maps-may-not-offer-scenic-routes-because-it-could-be-too-biased) — a former Google Maps researcher's explanation of why Google hasn't built scenic routing.

Our approach:
- Use objective signals (park proximity, POI diversity) not subjective "beauty"
- Let users define their own vibe preferences
- Test scoring model for income correlation
- Include "local discovery" as a positive signal

## License

MIT
