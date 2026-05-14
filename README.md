# Satellite pass prediction (React + Cloudflare)

Monorepo layout:

- [`apps/web`](apps/web) — Vite + React + TypeScript + Tailwind + shadcn-style UI, `satellite.js` pass prediction in the browser, MapLibre ground track, SVG sky plot, `next-themes` (system default + light/dark controls).
- [`apps/worker`](apps/worker) — Hono API on Cloudflare Workers: CelesTrak GP JSON + merged TLE lines, KV cache with soft/hard TTL stale-while-revalidate, optional AMSAT TLE bulletins, optional Space-Track GP (server secrets only), scheduled cron refresh.
- [`packages/shared`](packages/shared) — Zod schemas and shared types for API payloads.

## Local development

From the repository root (`sat-kt3i-com-web/`):

```bash
npm install
```

Terminal 1 — Worker (port **8787** by default):

```bash
npm run dev:worker
```

Terminal 2 — Web (port **5173**, proxies `/api` to the worker):

```bash
npm run dev:web
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:8787` (see [`apps/web/vite.config.ts`](apps/web/vite.config.ts)).

### Environment variables

**Worker (secrets, never commit):**

- `SPACE_TRACK_USER` / `SPACE_TRACK_PASSWORD` — optional; when set, the `iss-spacetrack` group can authenticate to [Space-Track](https://www.space-track.org/). Configure with `wrangler secret put SPACE_TRACK_USER` and `wrangler secret put SPACE_TRACK_PASSWORD`.

**Web:**

- `VITE_API_BASE` — optional absolute origin for the API in production (e.g. `https://api.example.com`). Leave unset when the SPA is served from the same origin as `/api` (recommended: route `/api/*` on your zone to the Worker).

See [`apps/web/.env.example`](apps/web/.env.example).

## Data freshness (KV + cron)

- **KV key** pattern: `celestrak:group:{groupId}` stores `{ fetchedAt, source, groupId, satellites, lastError? }`.
- **Soft TTL** (default **120** minutes): `GET /api/tle` returns cached data immediately and triggers `waitUntil(refresh)` in the background when the cache is older than the soft TTL.
- **Hard TTL** (default **720** minutes / 12 h): if the cache is older than the hard TTL, the Worker refreshes **before** responding (unless upstream fails; then stale data may be returned with `lastError` set).
- **Cron**: [`apps/worker/wrangler.toml`](apps/worker/wrangler.toml) runs `0 */4 * * *` (every 4 hours UTC) to refresh hot groups (`stations`, `visual`, `amateur`, `starlink`, `weather`). If Space-Track secrets exist, `iss-spacetrack` is refreshed on the same schedule.

Tune TTLs with Worker vars `SOFT_TTL_MINUTES` and `HARD_TTL_MINUTES` in `wrangler.toml` (or dashboard overrides).

## CelesTrak + `satellite.js`

CelesTrak GP JSON is the canonical catalog fields; the Worker also fetches `FORMAT=tle` for the same `GROUP` and merges `TLE_LINE1` / `TLE_LINE2` by NORAD ID so the browser can call `twoline2satrec` (supported in `satellite.js` v5). AMSAT groups expose TLE-only records.

## Deploying (Cloudflare Pages + Worker)

1. Create KV namespaces and bind `TLE_KV` — from `apps/worker` run `npx wrangler kv namespace create TLE_KV` and `npx wrangler kv namespace create TLE_KV --preview`, then paste the returned IDs into [`apps/worker/wrangler.toml`](apps/worker/wrangler.toml) as `id` and `preview_id`.
2. Deploy the Worker (`npm run deploy --workspace=@sat/worker` from repo root, or `cd apps/worker && npx wrangler deploy`).
3. Create a Pages project pointing at this repo with:
   - **Build command:** `npm run build --workspace=@sat/web`
   - **Build output directory:** `apps/web/dist` (root directory = repository root), **or** set root to `apps/web` and use `npm run build` / `dist`.
4. On your Cloudflare **zone**, route `example.com/api/*` to the Worker and `example.com/*` to Pages so the SPA can use relative `/api` calls with `VITE_API_BASE` empty.

Do **not** expose Space-Track credentials to Pages or the browser; they belong only in Worker secrets.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev:web` | Vite dev server |
| `npm run dev:worker` | `wrangler dev` |
| `npm run build` | Production build (web + worker typecheck) |
| `npm test` | Vitest in web and worker workspaces |

## License

MIT — see [LICENSE](LICENSE).
