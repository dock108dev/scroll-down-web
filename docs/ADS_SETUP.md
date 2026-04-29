# Ads Setup

## Current Strategy

Scroll Down Web monetizes free traffic with **manual Google AdSense ad units** —
not Auto ads. Manual placements give us tight control over which surfaces ever
host an ad and which never do (scoreboard rows, reveal controls, play-by-play,
EV cells, betting price rows). Free / unauthenticated viewers see ads when the
env config is fully populated; **paid (`tier=pro`) and admin viewers never load
the AdSense script at all**.

The single source of truth for "should this viewer see ads?" is
`shouldShowAds()` in `web/src/lib/ads/entitlements.ts`, surfaced to client
components via the `useAdGate()` hook in `web/src/lib/ads/useAdGate.ts`.
Do not duplicate that check in components — render one of the named ad
components (`<FeedAd>`, `<GameDetailAd>`, `<FairBetAd>`),
each of which already calls `useAdGate()` internally. New ad surfaces should
follow the same pattern: call `useAdGate()` once at the top of the component
and bail before rendering anything ad-related.

## Required Environment Variables

All ad env vars are **public** (`NEXT_PUBLIC_*`) — they are inlined into the
client bundle at build time, so changing any of them requires a rebuild + redeploy.

| Variable                              | Required for ads? | Example value                    | Purpose |
|---------------------------------------|-------------------|----------------------------------|---------|
| `NEXT_PUBLIC_ADS_ENABLED`             | Yes (must be `true`) | `true`                        | Global kill switch. Any value other than the literal string `true` disables ads. |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID`       | Yes               | `ca-pub-3337164122582315`        | AdSense publisher / client ID. Loader script and every `<ins>` tag use this. |
| `NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT`  | Per-slot          | `8899182394`                     | Slot ID used by the home feed `<FeedAd>` (top / mid / bottom feed). |
| `NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT`| Per-slot          | `9756968492`                     | Slot ID for game detail `after-hero` and `between-sections`. |
| `NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT`    | Per-slot          | `4772235121`                     | Slot ID for FairBet `top-info` and `bottom`. |
| `NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT`     | Per-slot          | `8443886825`                     | Slot ID for the game detail `bottom` placement. |

Behavior when a variable is missing:

- `NEXT_PUBLIC_ADS_ENABLED` is anything other than `true` → no script, no slots,
  anywhere.
- `NEXT_PUBLIC_ADSENSE_CLIENT_ID` is empty → `shouldShowAds()` returns `false`
  for every viewer; loader script is not mounted.
- A specific slot ID is empty → that named ad component renders `null`. The
  page renders without empty boxes; other slots are unaffected.

## AdSense Account Setup

1. Go to <https://www.google.com/adsense/start/> and sign in with the Google
   account that should own monetization for `scrolldownsports.dev`. Use a
   shared/role account if more than one person needs access — AdSense does not
   have first-class team membership.
2. Choose **"Get started"** → enter `https://scrolldownsports.dev` as the site,
   pick the country, and accept the AdSense terms.
3. Provide the payment profile details Google asks for (legal name, address,
   tax forms). Payouts are blocked until the threshold is reached and the
   address is verified by PIN, but ad serving begins after site approval.
4. Wait for site review. Google emails when the site is approved or rejected.
   Until approval, the loader script can be installed but ad units will not
   serve real ads — they render as blank space, which is fine for plumbing
   verification.

If the account already exists, sign in and use **Sites → Add site** to add the
domain (next section).

## Domain Setup

1. AdSense console → **Sites** → **Add site**.
2. Enter `scrolldownsports.dev`. Use the apex domain — subdomains and `www`
   do not need separate entries.
3. Google asks how you will connect the site. Pick **"AdSense code snippet"**
   or **"ads.txt snippet"**. We have both in this repo:
   - The loader script is mounted by `web/src/components/ads/AdSenseScript.tsx`
     in the root layout.
   - `ads.txt` is served as a static file from `web/public/ads.txt`.
4. Click **Request review**. Google crawls the live domain, sees the loader
   script + `ads.txt`, and either approves or sends a fix list (most common
   issues: missing privacy policy, thin content, blocked crawlers).

While waiting for approval, the manual ad units described below can already be
created — they will simply serve blank until the site is approved.

## Finding the Publisher / Client ID

The publisher ID is the string that starts with `pub-` (the AdSense client ID
is the same string with a `ca-` prefix: `ca-pub-XXXXXXXXXXXXXXXX`).

- AdSense console → top-right account icon → **Account information** → copy
  **Publisher ID**.
- Or: **Account → Settings → Account information**.
- Or: AdSense console URL — the ID is embedded as `?pcaid=pub-XXX...` after
  signing in.

Use the **`ca-pub-`** form (with the `ca-` prefix) when setting
`NEXT_PUBLIC_ADSENSE_CLIENT_ID`. The `ads.txt` file uses the **`pub-`** form
(no `ca-`).

## ads.txt Setup

`ads.txt` declares which networks may sell our inventory. AdSense refuses to
serve until the file is present at the domain root and lists Google's
authorized seller line.

The file lives at `web/public/ads.txt` and ships with the static export, so it
is served at `/ads.txt`. After AdSense approves the publisher ID, replace the
placeholder content with:

```
google.com, pub-3337164122582315, DIRECT, f08c47fec0942fa0
```

- Replace `pub-XXXXXXXXXXXXXXXX` with the actual publisher ID (no `ca-` prefix).
- `DIRECT` indicates we have a direct relationship with Google AdSense.
- `f08c47fec0942fa0` is Google's fixed certification authority ID — copy it
  verbatim, it is the same for every AdSense publisher.
- The file must be plain text, ASCII, with `\n` line endings, served as
  `text/plain`. The `public/ads.txt` static file already meets these
  requirements.

If we ever sell inventory through additional networks, append one line per
network. AdSense merges entries from multiple networks; do not remove the
Google line.

## Verifying ads.txt

After deploy:

1. Open <https://scrolldownsports.dev/ads.txt> in a browser. The page must
   render the single Google line as plain text — no HTML, no redirect.
2. From a terminal:

   ```bash
   curl -sSI https://scrolldownsports.dev/ads.txt | head
   curl -sS  https://scrolldownsports.dev/ads.txt
   ```

   The headers should include `200 OK` and `content-type: text/plain` (or
   `text/plain; charset=utf-8`). The body should be the single `google.com,
   pub-..., DIRECT, f08c47fec0942fa0` line.
3. AdSense console → **Sites → scrolldownsports.dev** → the **ads.txt** column
   should change from "Not found" / "Earnings at risk" to "Authorized" within
   24 hours of the file being live (often faster).

## Creating Manual Ad Units

We deliberately use **manual ad units only**. Auto ads are off. For each slot
variable in the table below, create one matching ad unit in AdSense:

1. AdSense console → **Ads → By ad unit → Create ad unit**.
2. Choose **Display ads** (do not pick In-feed, In-article, Anchor, Vignette,
   Multiplex, or any "automatic" variant).
3. Name the unit after the slot variable, e.g. `home-feed`, `game-detail`,
   `fairbet`, `bottom-game-detail`. The name is internal-only.
4. Set size to **Responsive** (the React code passes `data-ad-format="auto"`
   or `"horizontal"` and `data-full-width-responsive="true"` for `auto`, so a
   responsive unit will adapt).
5. Click **Create**, then copy the slot ID (the numeric `data-ad-slot` value
   inside the generated snippet — **not** the JS, just the number).
6. Paste the slot ID into the corresponding `NEXT_PUBLIC_ADSENSE_*_SLOT` env
   variable. Rebuild and redeploy.

Repeat for all four slot variables.

## Slot Mapping

Every named ad component reads one of the slot env vars. Use this table to
match an AdSense unit to the page and placement it serves.

| Env variable                            | Component                | Page                                  | Placement(s) |
|-----------------------------------------|--------------------------|---------------------------------------|--------------|
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID`         | `AdSenseScript`, all `AdSlot`s | All pages (mounted in root layout) | AdSense loader script + `data-ad-client` on every `<ins>` tag |
| `NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT`    | `<FeedAd>`               | `/` (Home — Today section)            | `top-feed` (after first cards), `mid-feed` (after 6–8 cards), `bottom-feed` (end of list) |
| `NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT`  | `<GameDetailAd>`         | `/game/[id]`                          | `after-hero` (below scoreboard / reveal), `between-sections` (after Game Flow) |
| `NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT`       | `<GameDetailAd>`         | `/game/[id]`                          | `bottom` (after all primary content) |
| `NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT`      | `<FairBetAd>`            | `/fairbet`                            | `top-info` (below intro/filter), `bottom` (after value list) |

Notes:

- The home feed reuses one slot ID across `top-feed`, `mid-feed`, and
  `bottom-feed`. AdSense allows the same ad unit to render multiple times per
  page; each `<AdSlot>` instance pushes once.
- Game detail intentionally splits into two slot IDs: `GAME_DETAIL_SLOT` for
  the inline placements and `BOTTOM_SLOT` for the page-bottom placement. This
  lets us tune the bottom unit's format separately if we ever want to.
- FairBet uses a single slot ID for both placements.

## Local Development

Local default in `web/.env.local.example` is `NEXT_PUBLIC_ADS_ENABLED=false`
with all slot IDs blank, so:

- The AdSense loader script never mounts.
- Every named ad component returns `null` (slot ID empty).
- `shouldShowAds()` short-circuits on the kill switch.

That is the recommended local default — work on real product features without
ads in the way.

To exercise the ad code paths locally:

1. Copy `.env.local.example` to `.env.local`.
2. Set `NEXT_PUBLIC_ADS_ENABLED=true`.
3. Set `NEXT_PUBLIC_ADSENSE_CLIENT_ID` to a real `ca-pub-...` (a test account
   is fine; a wrong ID just makes the script 404 silently).
4. Set whichever slot var(s) you want to render. Empty slots stay hidden.
5. Restart `npm run dev` (env vars are read at process start).

If only validating layout reservation / CLS, you can leave the slot IDs blank
and read `<AdSlot>` directly with a fake slot in a unit test — the placeholder
`<div>` reserves height even before mount.

## Staging / Preview

Staging and preview environments should default to ads **off** so that QA does
not pollute AdSense impression metrics or accidentally test against production
slots:

- Set `NEXT_PUBLIC_ADS_ENABLED=false` in the staging environment file.
- Or set it `true` but leave all slot IDs blank — same result, since each
  named component renders `null` without a slot.

When promoting a build from staging to production, ensure the production env
file flips the kill switch to `true` and includes all four slot IDs.

## Production Verification

After a production release with ads enabled:

1. Open <https://scrolldownsports.dev/> in an **incognito window** (no logged-in
   session, so the viewer is treated as free).
2. Open DevTools → **Network** tab. Filter for `adsbygoogle`.
3. Reload. You should see at least one request to
   `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-...`
   with status `200`.
4. Scroll the home feed. After the configured cutoffs, ad containers labeled
   "Ad" should appear with reserved height (no layout shift around game cards).
5. Open a game detail page; verify ad blocks render after the hero, between
   sections, and at the bottom.
6. Open `/fairbet`; verify ads render above and below the bet list — never
   between rows.

## Paid User Verification

The mechanism: `AdSenseScript` is a `"use client"` component that subscribes to
the `useTier` and `useAuth` Zustand stores. When `tier === "pro"` or
`role === "admin"` (or before the tier store is initialized), it returns
`null` and the `<Script>` tag is never mounted. As a result the loader URL is
never fetched — paid viewers do not even contact AdSense's CDN. Each named ad
component (`FeedAd`, `GameDetailAd`, `FairBetAd`) repeats the same gate via
`shouldShowAds()` so an `<ins>` tag is also never rendered into the DOM.

Verify per release:

1. Sign in as a `tier=pro` user (or use the admin role from `useAuth`).
2. Open DevTools → **Network** tab. Filter for `adsbygoogle`.
3. Reload the home page, a game detail page, and `/fairbet`.
4. **Expected: zero requests to `adsbygoogle.js` and zero requests to
   `pagead2.googlesyndication.com`**. The filter list should stay empty.
5. Open DevTools → **Elements**. Search the DOM for `adsbygoogle` (the class
   used by the `<ins>` tag). **Expected: zero matches.**
6. Search the DOM for `id="adsense-loader"`. **Expected: zero matches** — the
   `<Script>` tag is gated out before it ever renders.
7. Repeat steps 4–6 for an admin session. Same expectations.

If any of those checks fail, do not ship: it means a viewer-store change has
broken the gate, or a component is bypassing `shouldShowAds()`.

## Disabling Ads Globally (Rollback)

To kill all ads instantly across the site:

1. In the production environment file, set:

   ```
   NEXT_PUBLIC_ADS_ENABLED=false
   ```

2. Rebuild and redeploy. (Public env vars are inlined at build time, so a
   restart alone is not enough — the bundle has to be rebuilt.)
3. Verify with the **Network tab → filter `adsbygoogle`** check from the
   previous section. There should now be **zero** requests for **every**
   viewer, including unauthenticated free viewers.

This is the recommended rollback path if anything goes wrong: bad placement
report, AdSense policy issue, layout regression, etc. It does not require
removing or editing any slot IDs.

If a faster rollback is needed and a rebuild is not viable, an alternative is
to set `NEXT_PUBLIC_ADSENSE_CLIENT_ID` to an empty string (same rebuild
constraint), which forces `shouldShowAds()` to short-circuit and prevents the
loader script from mounting.

## What NOT to Enable Yet

Manual ad units are deliberate. The following features are off and should
**stay off** until we have a measured reason to revisit:

- **Auto ads** — Google's algorithmic page scanner. It will inject ads inside
  reveal controls, between scoreboard and PBP, and into FairBet rows. All of
  those break the product's trust contract.
- **Anchor ads** — sticky bottom-of-viewport ads. Conflict with the bottom tab
  bar on mobile and steal vertical space on the smallest screens.
- **Vignette ads** — full-page interstitials between page transitions. Block
  the "open a game, glance, leave" flow we are explicitly designing for.
- **Popup / interstitial ads** — same reason as vignettes; also a trust hit.
- **Ads inside FairBet bet rows** — between rows, next to EV numbers, near
  "best price" / book name cells. Makes the page feel like an affiliate
  spam farm.
- **Ads inside play-by-play (PBP)** — the PBP timeline must read as data,
  never as sponsored content.
- **Ads inside Game Flow blocks** — same reason as PBP.
- **Ads between scoreboard / reveal controls and the data they unlock** —
  breaks reveal gating.
- **Sticky ads, video ads** — explicitly excluded by the UX rules in
  `BRAINDUMP.md`.

## Future Options

After the manual placements have been live, stable, and approved by AdSense
for a meaningful window (suggested: at least one full month with no policy
warnings or layout shift complaints), the following can be evaluated:

- **Auto ads** — start with a single page (probably the home feed) at a low
  density. Compare CTR / RPM against the manual unit before considering
  wider rollout.
- **Right-rail desktop ads** — only if the desktop layout already supports an
  unobtrusive rail; do not introduce a rail for ads.
- **Additional ad networks** — would require updating `ads.txt` with each
  authorized seller. Keep the Google line; append, never replace.

None of those changes should reach production without a documented
before/after for layout stability and paid-user suppression. The verification
steps in **Production Verification** and **Paid User Verification** should
pass unchanged after any expansion.
