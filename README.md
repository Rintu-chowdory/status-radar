# StatusRadar

A live status board for 28 cloud services, read straight from each provider's official
Statuspage JSON API. No scraping, no API keys, no backend.

**Live:** https://status-radar.vercel.app

## What it does

- **One grid, real data.** Every card is fed by
  `https://<provider>/api/v2/summary.json`: indicator, open incidents and component
  states, refreshed every 60 seconds.
- **Severity is derived, not guessed.** The page indicator is authoritative, but a
  component sitting in `major_outage` wins over a stale indicator.
- **Service detail** (click any card): open incidents with impact and first update,
  scheduled maintenance, components grouped as the provider groups them, and a 30-day
  incident chart built from `/api/v2/incidents.json`. Overlapping incidents are merged
  per day, so the figure is time with at least one incident open, not a sum that a
  provider with many simultaneous regional incidents could inflate.
- **Latency history.** Each check is timed around the fetch and plotted as a sparkline.
- **Filters:** search, category chips, "problems only", sort by severity, name or latency.
- Survives reload without a blank screen: the last snapshot is cached locally and
  clearly aged ("updated 3 min ago"), never presented as fresh.

## Honest limits

- The millisecond figure is **your browser's round trip to the provider's status API**.
  It is not a probe of the service itself and it is not a global measurement.
- A card reading "check failed" means *this browser could not read their status page*
  (network, CORS, timeout). That is different from the service being down, and the UI
  keeps the two apart.
- Status comes from the provider's self-reporting. A provider that under-reports an
  incident will look healthy here.
- Not implemented yet: user "is it down for you?" reports, GeoIP outage maps, alerting,
  German services (Telekom, Vodafone, DB). Those need a backend with a database, which
  this client-only MVP deliberately avoids.

## How it works

```
browser ──30s──> /api/status ──45s module cache──> <provider>/api/v2/status.json  (~220 B each)
   │                  │
   │                  └── CDN: s-maxage=45, stale-while-revalidate=60
   │
   └──on click──> /api/service?id=x ──60s cache──> summary.json + incidents.json
                          │
                          v
                 severity, components, incident history
```

Two functions, one job each:

| Endpoint | Cache | Payload |
| --- | --- | --- |
| `GET /api/status` | 45s module cache + 45s CDN | all 28 services, ~220 bytes each |
| `GET /api/service?id=<id>` | 60s module cache + 60s CDN | components + incident history for one |

**Why a proxy at all.** Thirty visitors polling every 30 seconds would be 30x the load on
each provider. Through the proxy, providers see at most one sweep per 45 seconds no matter
how many people have the board open, and the CDN answers most of those without waking the
function. The board reads `status.json` (~220 bytes) rather than `summary.json`; the heavy
summary is fetched only when someone opens a service, and it is cached separately
(Cloudflare's is 223 KB).

**A failed check is never shown as healthy.** If a provider does not answer, the proxy
keeps the last known state, marks it `stale` and passes the error through, so the card
keeps its real colour but gains a warning icon and stops claiming to be current. Once the
last successful fetch is more than 5 minutes old, the state drops to `unknown` and the
badge turns grey. Verified with a stubbed upstream: fresh failure → previous state + error,
6-minute-old failure → `unknown`.

Adding a service is one line in `src/lib/services.ts`; the proxy shares that catalog.

### The CORS trap worth knowing

`status.shopify.com` 301-redirects to `www.shopifystatus.com`, and the **redirect
response carries no `Access-Control-Allow-Origin`**. Chrome therefore fails the request
even though the final 200 does send it. The catalog points at canonical hosts to avoid
that. Same rule applies to any service that starts redirecting: follow the chain, use
the final host.

## Run locally

```bash
npm install
npm run dev       # UI only, on :5173 - /api/* is not served, so the board shows the offline banner
npm run dev:full  # vercel dev, serves the UI and both functions together (what you want)
npm run build     # typecheck (src + api) + production build
```

`npm run dev` alone cannot reach `/api/status`, which is the intended behaviour: the UI
says live data is unavailable instead of quietly falling back to something else.

## Gotcha: ESM functions on Vercel

`package.json` sets `"type": "module"`, so the compiled functions run as ESM where
extensionless imports do not resolve. `import { boardStatuses } from './_lib'` deployed
fine and then failed at runtime with `ERR_MODULE_NOT_FOUND`. Every import inside `api/`
(and into `src/lib/`) therefore carries an explicit `.js` extension. `vercel build` plus a
local invoke of the compiled handler catches this before it reaches production.

## Deployment

Vercel, deployed from `main` by `.github/workflows/vercel-deploy.yml`. CI typechecks and
builds on every push and pull request.

MIT licensed. Status page data belongs to the respective providers.
