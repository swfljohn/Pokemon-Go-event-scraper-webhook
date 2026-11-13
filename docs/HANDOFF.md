# Handoff

This file explains how the project works, why it's built this way, and what's left to do. The event scraper, the
posts and the graphics were pulled out of a larger private site. The rest of that site isn't
here. A few event records still carry fields it used (`automation`, `plannerTargetRestrictions`, `nativeTargetLevel`).
Nothing in this repo reads them, and it's safe to leave or delete them.

## How it works

```
cron (every minute)
  └─ fetchEventSpawns({ refreshDiscovery: true })     app/lib/event-spawns.js
       ├─ ScrapedDuck events JSON (ETag, 10-min cache, last-good copy kept in D1)
       ├─ official news + regional articles (30-min cache, batched, retires 404s)
       ├─ curated local events / stamp rallies / raid schedules / reviewed details
       └─ normalizeEventSpawns → calendarEvents (stored as one computed result in D1)
  ├─ runAutomaticEventDigests   → admin ("owner") webhooks      app/lib/event-notifications.js
  └─ enqueueAutomaticDiscordEventWebhooks → subscriber webhooks app/lib/discord-event-webhook-notifications.js
queue consumer
  ├─ { type: "event-digest" | "starting-soon" | ... } → processEventNotificationQueue
  └─ { type: "discord-event-webhook" }                → processDiscordEventWebhookQueue
```

There are two kinds of webhook:

- **Admin webhooks** belong to the `owner` workspace and are added in `/admin`. Their settings live in D1 key/value
  (`app_kv`), with the URL encrypted. Each one chooses which posts it gets (`digestKinds`). Each one also has a
  `dailyPost` setting: `both` (the daily review, then the local-only post), `daily` (review only) or `local`
  (local-only post only). That setting is how you run a separate local-events channel.
- **Subscriber webhooks** are one per Discord user who signs up on `/`. They have their own D1 tables
  (`migrations/0002`) with an encrypted URL, a fingerprint so the same webhook can't be saved twice, a delivery ledger
  with batch checkpoints, retry and backoff, and auto-pause when Discord answers 401, 403 or 404. A webhook is tested
  when it's saved, and saving a new URL sends a test before anything else.

Deliveries are idempotent. Each scheduled post is claimed per owner, kind and local date before it's queued, and
claims are released if queueing fails. A retried delivery skips the batches that already went out. The worker test
checks that a second cron run in the same minute posts nothing new.

## Post schedule and content rules

These rules came from running the original Discord feed. The code enforces them, and the tests cover most of them.

- The daily post goes out the evening before, at 6:05 PM in the poster's time zone, and covers the next day. Posts
  sent from noon onward cover the next day (`reviewAheadDays`).
- Today's events are the main focus. After them come upcoming events and short local-only events.
- A GO Pass or season graphic appears only on the day a new pass or season starts. GO Battle League appears only on
  the day a cup changes.
- No grades appear in posts. The rating code still exists (`event-rating.js`) because it feeds the calendar.
- The "this weekend" post is retired. It's off by default and skipped by the scheduler even if turned on, so remove
  the skip in `automaticDigestRuns` to bring it back. Week ahead goes out Sunday morning. Season & GO Pass is checked
  daily and only posts when something new starts.
- No emoji in the review posts, because some servers strip them. Links point to this site's `/events?event=<id>`,
  never to the source feed.
- The image is the designed graphic. The copyable text goes under it, kept short, with a dex number next to each
  Pokémon (`` `25:3379` `` = dex:form) and coordinates next to each local event.
- Local-events-only lists events that are live now and have coordinates. It leaves out long-running events (stamp
  rallies, museum exhibits, anything over 4 days). Its text uses Discord `<t:…>` timestamps so each reader sees their
  own time zone, while the picture keeps the venue's local time.
- Sprites must be exact. The order is: the event source's own icon, then form/costume art resolved by name, then Mega
  icons by dex, then the base sprite with a shadow treatment for Shadow Pokémon. If none of those match, the Pokémon
  is left out of the picture. Never use a placeholder.
- Never invent event content (Pokémon, forms, costumes, bosses, bonuses, times, coordinates). If it isn't verified,
  leave it out. The curated files cite a `sourceUrl` or `provenance` for each entry.
- Many readers are in servers worldwide, so posts cover global events, not only the owner's region.

## Security notes

- Webhook URLs are secrets. They're stored AES-256-GCM encrypted with `EVENT_WEBHOOK_ENCRYPTION_KEY`, shown only
  masked (`••••1234`), and redacted from logs and error messages.
- Login uses Discord OAuth with only the `identify` scope. The state is a random value held in a short-lived cookie
  scoped to the callback path. Sessions are HMAC-signed and last 7 days, sliding while the user is active.
- Every cookie-authenticated POST must come from this site's origin (`browserMutationIsTrusted`).
- Users can only see and change their own subscription. Admin access comes only from `ADMIN_DISCORD_IDS` or
  `ADMIN_API_TOKEN`.
- Access is checked again on every request, so disabling a user in `/admin` blocks them immediately. It also pauses
  their webhook so posts stop.
- Custom bot names reject reserved and impersonating names such as "Pokémon GO Official", "Discord" or "Support"
  (`normalizeEventWebhookBranding`).

## Tests

`npm test` runs about 140 `node:test` tests with no network. `test/helpers/d1.mjs` fakes D1 with `node:sqlite` and
the real migrations. `test/worker.test.mjs` runs the whole flow:

1. Discord login
2. Signup with a webhook that's tested on save, encrypted at rest and never echoed back
3. Pause and resume
4. A cross-site POST, which must be refused
5. The admin overview, adding webhooks, and the previews
6. A scheduled run through the queue to the admin, local-only and subscriber webhooks, with no duplicates on the
   next run

## Changes 2026-11-13

Ported from the original site after a day of testing the graphics in real Discord servers.

- **Graphic redesign** (`app/lib/daily-review.js`). The day name is the headline. The event with the most to show leads
  with its banner. Each group of Pokémon is a row: a coloured label tile on the left, a grid of fixed-size sprites on
  the right, and a gold star on any that can be shiny. Bonuses are tiles. Times are pills: filled gold means it starts
  that day, outlined means it's ending. The picture is as tall as the content. The font is Poppins.
- **Post order** (picture and text): main event, Raids, PvP changes, season/GO Pass, tomorrow, then "Also happening"
  last.
- **"local" next to global times.** Events that run on each player's clock now say so, e.g. "Starts 10 AM local".
- **Grouped Pokémon in the feed.** Event details carry `pokemonGroups`: one entry per heading the source uses
  (habitat hours, Mighty Pokémon by day, incense, eggs, raid tiers, day-by-day raid and Max Battle bosses), each
  with `section`, `title`, `day` (`MM-DD` or empty), `note` and `pokemon` (`name`, `imageUrl`, `shiny`). The
  parser is `detailPokemonGroups()` in `event-spawns.js`. It reads h3–h6 and short heading-like paragraphs, and
  ignores "100% IV CP" stat lines. The detail cache schema went to 4, so pages are re-read once after deploying.
- **Hand-reviewed groups win.** Big events where spawns rotate by the hour (GO Fest, Wild Area) get groups written
  in `featured-event-details.js` from the official page, and those replace whatever the parser read. Wild Area 2026:
  Global is the example (`wildAreaPokemonGroups`): Steel and Dragon habitat hours with their times, Mighty Pokémon
  per day, 10 km eggs, 3-star and day-by-day 5-star raids, 6-star G-Max Duraludon, and day-by-day Max Battles. No
  source splits Mighty Pokémon by hour, so they're labelled "every hour, 10 AM–6 PM local".
- **Each day's post shows only that day's groups.** Undated groups always show; dated ones only on their day.
- **Event page** (`app/pages/events-page.js`). A selected event (`/events?event=<id>`) shows its grouped Pokémon with
  day pills, notes and shiny stars.
- **Subscriber webhooks get the graphic.** Their daily post is now the same graphic + text as admin webhooks, in the
  subscriber's time zone (`dailyReviewParts()` in `event-notifications.js`). Before, they got the older card-style
  post.
- **Cost check.** Rendering is billed by browser time. Each picture takes about 1–5 seconds, so a few hundred posts a
  month use well under the 10 hours included with Workers Paid.

## Unfinished / next

1. **Turn on the PNG graphics in production.** The design is complete and previewable (`npm run preview:graphics`,
   `/admin` → Post previews). Posting PNGs only needs `CLOUDFLARE_ACCOUNT_ID` and `BROWSER_RENDERING_TOKEN` set.
   Check the first rendered post in Discord for clipped text on long event names. Sprites load from GitHub and
   LeekDuck at render time, so a slow CDN can leave a gap. `networkidle0` with a 30-second timeout covers most cases.
2. **Reviewed autumn event batch.** `reviewed-autumn-events.js` holds source-checked detail for several fall 2026
   events. Only Into the Wild is wired in (`featuredEventDetails`). To add the others, list their ids there after
   re-checking the sources.
3. **Subscriber choice of daily mode.** Admin webhooks can pick `both`, `daily` or `local`. Subscriber webhooks always
   get `both` (daily graphic, then the local-events post). To add it, store `dailyPost` in the subscriber's `settings_json` and pass it where
   `discord-event-webhook-notifications.js` builds messages.
4. **Custom bot names for subscribers.** Admin webhooks post under the bot name set in `/admin`. Subscriber webhooks
   always post as the default name. The pieces exist: a per-user `customWebhookBranding` flag in `access.js`, and
   name validation in `normalizeEventWebhookBranding`. To finish it, show a bot-name field on the signup page for
   allowed users and pass `username` in `discord-event-webhook-notifications.js` when posting.
5. **Meta rankings refresh.** `event-meta-rankings.js` is a September 2026 snapshot of PvPoke and raid-attacker
   rankings. The generator wasn't carried over.
6. **Hand-reviewed groups for the next big hourly event.** Copy the Wild Area pattern in `featured-event-details.js`
   when the next GO Fest or Wild Area is announced.
7. **Data retention.** Delivery rows are pruned by the webhook queue code (90 days). There's no general D1 cleanup job
   yet for old `event:detail:*` keys.
