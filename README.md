# Pokémon GO Event Webhook

Run your own Pokémon GO event feed for Discord. It scrapes the event calendar every minute, then posts to Discord
webhooks on a schedule:

- **Daily post**, sent the evening before: the next day's events, raids and Max Battles, as a 1080×1350 graphic plus
  copyable text with dex numbers.
- **Local events only**: in-person events that are live, with coordinates and end times shown in each reader's own
  time zone. It can go to the same channel as the daily post or to a separate one.
- **Week ahead** and **Season & GO Pass** posts, in the same style.
- An optional alert about 2 hours before a nearby local event starts.

Anyone can sign in with Discord on the home page and connect their own server's webhook. You manage everything from
`/admin`.

It runs on Cloudflare Workers, D1 and Queues, so you don't need a server. Plan on the Workers Paid plan: Queues and
D1 are available on the Free plan, but parsing the event sources is likely to exceed the Free plan's CPU limit.

> Not affiliated with Niantic, Scopely, Nintendo, Game Freak or The Pokémon Company. Event data comes from public
> community and official sources (see [Data sources](#data-sources)). Please respect their terms.

## What's in the box

| Path | What it does |
| --- | --- |
| `src/worker.js` | Worker entry. Handles HTTP routes, the every-minute cron (scrape, then scheduled posts) and the delivery queue. |
| `app/lib/event-spawns.js` | The scraper. It reads ScrapedDuck/LeekDuck, official Pokémon GO news (including regional articles in 16 languages) and event detail pages. It merges in curated local events, stamp rallies and raid schedules, keeps the last good copy in D1 and records per-source health. |
| `app/lib/local-events.js`, `featured-event-details.js`, `*-stamp-rall*.js`, `official-regional-*.js`, `reviewed-autumn-events.js` | Hand-checked event data the sources miss: venues, coordinates and local time zones. |
| `app/lib/daily-review.js` | Builds the daily, local-only, week-ahead and season posts, both the graphic (HTML, rendered to PNG) and the text. |
| `app/lib/event-notifications.js` | Digest selection, schedules, Discord message building, de-duplication, and posting to the admin's webhooks. |
| `app/lib/discord-event-webhook-*.js` | Subscriber webhooks. People who sign up get their own encrypted webhook, a delivery ledger, retries, and auto-pause when Discord rejects a webhook. |
| `app/api/*` | Discord OAuth (`discord-login`, `discord-callback`), `session`, `server-alerts` (the signup API), `admin` and the public `events` API. |
| `app/pages/*` | The signup page (`/`), the admin panel (`/admin`) and the public event list (`/events`). Plain HTML with no build step. |
| `migrations/` | D1 schema. |
| `scripts/preview-graphics.mjs` | Renders the post graphics locally so you can work on the design. |
| `docs/HANDOFF.md` | How it all fits together, design decisions, and what's unfinished. Read this before changing things. |

## Setup (about 15 minutes)

You need Node 22+, a Cloudflare account (Workers Paid recommended, see above), and a Discord application.

```sh
git clone https://github.com/swfljohn/Pokemon-Go-event-scraper-webhook && cd Pokemon-Go-event-scraper-webhook
npm install
npx wrangler login
```

**1. Create the Cloudflare resources**

```sh
npx wrangler d1 create pokemon-go-events              # copy the database_id into wrangler.jsonc
npx wrangler queues create pokemon-go-event-posts
npx wrangler queues create pokemon-go-event-posts-dlq
```

In `wrangler.jsonc`, set `SITE_URL` to where the Worker will live, e.g. `https://pokemon-go-event-webhook.<subdomain>.workers.dev`
or your own domain. You can also set `SITE_NAME`, `DEFAULT_TIME_ZONE` and `SIGNUP_MODE` there.

**2. Create a Discord application** at <https://discord.com/developers/applications>. Under OAuth2, add the redirect
`<SITE_URL>/api/discord-callback`. Copy the Client ID and Client Secret.

**3. Add secrets**

```sh
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put ADMIN_DISCORD_IDS              # your Discord user ID; comma-separate several
npx wrangler secret put SESSION_SECRET                 # long random string
npx wrangler secret put EVENT_WEBHOOK_ENCRYPTION_KEY   # long random string; changing it later makes saved webhooks unreadable
```

To generate the random strings, run `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

**4. Deploy**

```sh
npm run deploy        # applies D1 migrations, then deploys
```

Open `<SITE_URL>/admin` and sign in with Discord. The first scrape runs within a minute. Add your channel's webhook
under **Your webhooks** and set your schedule under **Your post settings**. To see the posts before they go out, use
**Post previews**.

### Local development

```sh
cp .dev.vars.example .dev.vars   # fill it in; add http://localhost:8787/api/discord-callback as a Discord redirect
npm run dev
npm test                         # node:test, no network needed (D1 is faked with node:sqlite)
```

## Configuration

| Name | Where | Default | Meaning |
| --- | --- | --- | --- |
| `SITE_URL` | var | — | Public URL. Used for OAuth redirects, links in posts and the graphic footer. |
| `SITE_NAME` | var | `Pokémon GO Event Webhook` | Shown on the pages, in the graphic header and in test messages. |
| `DEFAULT_TIME_ZONE` | var | `America/New_York` | Starting time zone for the admin's posts. You can change it in `/admin`. |
| `SIGNUP_MODE` | var | `open` | `open`: anyone can add a webhook. `approval`: you approve each new user in `/admin`. `closed`: only users you add. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | secret | — | Discord OAuth. Only the `identify` scope is requested. |
| `ADMIN_DISCORD_IDS` | secret | — | Comma-separated Discord user IDs with admin access. |
| `SESSION_SECRET` | secret | — | Signs login cookies. |
| `EVENT_WEBHOOK_ENCRYPTION_KEY` | secret | — | Encrypts every saved webhook URL (AES-256-GCM). At least 24 characters. |
| `ADMIN_API_TOKEN` | secret, optional | — | Lets scripts call `/api/admin` with `Authorization: Bearer <token>`. |
| `ADMIN_WEBHOOK_URL` | secret, optional | — | A webhook that always gets the admin posts. Its settings can be edited in `/admin` but it can't be removed there. |
| `CLOUDFLARE_ACCOUNT_ID`, `BROWSER_RENDERING_TOKEN` | secret, optional | — | Turns on the PNG graphics. See below. |

## Daily graphics

Each post is built twice from the same data: as a self-contained HTML page (1080 px wide, dark purple theme, sprites
from public icon sets) and as plain text. When `CLOUDFLARE_ACCOUNT_ID` and `BROWSER_RENDERING_TOKEN` are set, the HTML
is screenshotted with [Cloudflare Browser Rendering](https://developers.cloudflare.com/browser-rendering/). The PNG is
posted as its own message first, then the text. Without them, posts go out as text only and nothing else changes.

1. Create an API token with the **Account → Browser Rendering → Edit** permission.
2. Run `npx wrangler secret put CLOUDFLARE_ACCOUNT_ID` and `npx wrangler secret put BROWSER_RENDERING_TOKEN`.
3. In `/admin` → **Post previews**, click **Render PNG** to check it.

To work on the design locally (edit `app/lib/daily-review.js`, then re-run):

```sh
npm run preview:graphics                     # sample data → out/graphics/*.html + *.txt
npm run preview:graphics -- --png            # also screenshots with your local Chrome
npm run preview:graphics -- --live --png --tz Europe/London   # real sources, needs network
```

Design rules the code follows:

- No emoji, because some servers strip them.
- Only facts that are on the calendar.
- A Pokémon with no exact sprite is left out of the picture rather than given a stand-in.
- Times in the picture are the venue's local time. The text uses Discord timestamps, so each reader sees their own
  time zone.

## Endpoints

| Route | Who | |
| --- | --- | --- |
| `GET /` | anyone | Signup page |
| `GET /admin` | admins | Admin panel |
| `GET /events` | anyone | Event list. Posts link to `/events?event=<id>`. |
| `GET /api/events` | anyone | All events as JSON. Add `?id=` for one event with scraped details, or `&format=gpx` for venue coordinates. |
| `GET/POST /api/server-alerts` | signed-in users | Read the user's subscription, or `?action=save` / `test` / `pause` / `delete` |
| `GET/POST /api/admin` | admins | Overview, `?preview=today\|local\|week\|monthly&format=html\|text\|png[&at=ISO]`, `?action=...` |
| `GET /api/discord-login`, `/api/discord-callback`, `GET /api/session`, `POST /api/logout` | anyone | Sign-in |

## Data sources

- [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck) (a LeekDuck scrape) and [LeekDuck](https://leekduck.com)
  event pages
- [Pokémon GO news](https://pokemongo.com/news), including regional articles in 16 languages
- Hand-checked local events, stamp rallies and venues in `app/lib/`
- Sprites from [PokeMiners](https://github.com/PokeMiners) / [WatWowMap UICONS](https://github.com/WatWowMap/wwm-uicons)
  via GitHub, plus LeekDuck event icons

The scraper identifies itself as `PokemonGoEventWebhook/1.0`, caches heavily and never fetches on a visitor's request
when a fresh copy is stored. Please keep it polite.

## License

MIT. See `LICENSE`. Pokémon and Pokémon GO are trademarks of their respective owners.
