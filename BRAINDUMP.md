# BRAINDUMP.md — Scroll Down Web Ads + Paid Suppression
## Goal
Integrate ads into Scroll Down Web in the cleanest possible way for free users, while making sure any paid/beta/admin-entitled account gets a completely ad-free experience.
This should not turn the app into a noisy ad farm. The product goal is still trust, speed, game flow, and readability. Ads should monetize free traffic without damaging the core “check the game without getting spoiled / get the flow fast” experience.
Primary ad path: **Google AdSense**.
AdSense supports Auto ads and manual ad units. Auto ads are easiest but can be noisy; manual ad units give more placement control. Google’s own docs describe manual ad units as spaces the publisher creates and manages directly, while Auto ads are configured in AdSense and loaded across pages.  [oai_citation:0‡Google Help](https://support.google.com/adsense/answer/9183549?hl=en&utm_source=chatgpt.com)
---
## Core Rules
1. Free users see ads.
2. Paid users see no ads.
3. Admin users see no ads.
4. Beta users can be controlled by entitlement flag.
5. Ads must never appear inside the most important data-trust surfaces:
   - scoreboard row
   - game status
   - reveal/tap-to-show controls
   - live/pre-final score areas
   - play-by-play rows
   - betting price cells
   - FairBet EV rows
6. Ads should be lazy, stable, and non-blocking.
7. Ads should reserve layout space so the app does not jump around.
8. If the ad config is missing, the app should quietly render no ads.
9. AdSense account setup should be documented after implementation, including `ads.txt`.
Google recommends `ads.txt` because it declares who is authorized to sell the site’s ad inventory and helps prevent counterfeit inventory. The file lives at the domain root, and Google’s sample format is `google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0`.  [oai_citation:1‡Google Help](https://support.google.com/adsense/answer/12171612?hl=en&utm_source=chatgpt.com)
---
## Product Placement Strategy
### Best first version
Do **manual ad units first**, not aggressive Auto ads.
Auto ads may be useful later, but this app has sensitive UX:
- reveal gating
- game cards
- odds/EV trust
- quick-scroll mobile behavior
- completed game summaries
- pregame betting screens
Auto ads could insert themselves in dumb places. For v1, manual placements are safer.
### Free user ad placements
#### Games home page
Allowed:
- one top feed ad after the first few game cards
- one mid-feed ad after 6–8 game cards
- one bottom-feed ad near end of list
Avoid:
- above the first game
- between scoreboard and primary CTA
- inside a single compact game card
- repeated ads every 2 cards
#### Game detail page
Allowed:
- one ad after the hero / scoreboard / reveal block
- one ad between major sections, for example after Game Flow
- one bottom ad after all primary content
Avoid:
- inside Game Flow blocks
- inside play-by-play
- between score and team names
- between odds rows
- anywhere that makes a user think ad content is game data
#### FairBet page
Be extra conservative.
Allowed:
- one top informational ad below page intro/filter area
- one bottom ad after the value list
Avoid:
- inside the bet table/list
- between bet rows
- next to EV numbers
- near “best price” buttons
- near book names/prices
This is a trust page. Bad ad placement here makes the app feel scammy.
---
## Technical Architecture
Create a small ad system instead of sprinkling AdSense code everywhere.
Suggested files:
```txt
web/src/lib/ads/config.ts
web/src/lib/ads/entitlements.ts
web/src/components/ads/AdSenseScript.tsx
web/src/components/ads/AdSlot.tsx
web/src/components/ads/AdBoundary.tsx
web/src/components/ads/AdPlaceholder.tsx
web/src/components/ads/FeedAd.tsx
web/src/components/ads/GameDetailAd.tsx
web/src/components/ads/FairBetAd.tsx
web/src/app/ads.txt/route.ts
docs/ADS_SETUP.md

⸻

Environment Variables

Add:

NEXT_PUBLIC_ADS_ENABLED=false
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT=
NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT=
NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT=
NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT=

Rules:

* local/dev defaults to disabled
* preview/staging can be disabled
* production can be enabled once AdSense is approved
* missing client ID or slot ID should render nothing

⸻

Entitlement Model

Create one function that decides whether ads are allowed.

Pseudo-contract:

type ViewerEntitlements = {
  isAuthenticated: boolean;
  isAdmin?: boolean;
  isPaid?: boolean;
  isBeta?: boolean;
  suppressAds?: boolean;
};
export function shouldShowAds(viewer: ViewerEntitlements | null): boolean {
  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== "true") return false;
  if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID) return false;
  if (!viewer) return true;
  if (viewer.isAdmin) return false;
  if (viewer.isPaid) return false;
  if (viewer.suppressAds) return false;
  return true;
}

This should become the single source of truth.

Do not check paid/admin status ad hoc in components.

⸻

Components

AdSenseScript

Loaded once near root layout, but only when ads are enabled for the current viewer.

Use Next Script with lazy/afterInteractive behavior.

The script should not load for paid/admin users at all.

AdSlot

Generic manual ad slot.

Responsibilities:

* reserve height
* render only client side if needed
* safely call AdSense push once
* avoid duplicate push on rerenders
* no crash if window.adsbygoogle is missing
* no hydration weirdness
* no visible placeholder for paid users

Props:

type AdSlotProps = {
  slot: string;
  format?: "auto" | "rectangle" | "horizontal";
  className?: string;
  minHeight?: number;
  label?: string;
};

AdBoundary

Wrapper that receives viewer/session and decides whether children render.

<AdBoundary viewer={viewer}>
  <FeedAd position="mid-feed" />
</AdBoundary>

Named ad components

Use named components instead of raw slots everywhere:

<FeedAd />
<GameDetailAd />
<FairBetAd />

This keeps placement readable and lets us change slot IDs later without hunting through app code.

⸻

ads.txt

Implement one of these:

Option A: static file

public/ads.txt

Content after account setup:

google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0

Option B: route handler

// src/app/ads.txt/route.ts
export function GET() {
  const pubId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.replace("ca-", "");
  if (!pubId) {
    return new Response("", {
      headers: { "content-type": "text/plain" },
    });
  }
  return new Response(
    `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`,
    {
      headers: { "content-type": "text/plain" },
    }
  );
}

Static is probably simpler and safer.

⸻

Paid Suppression

The key implementation task is not just hiding slots. It is making sure ad scripts never load for paid users.

Acceptance:

* paid user page source / browser network should not request AdSense script
* admin user should not request AdSense script
* free unauth user may request AdSense script
* free auth user may request AdSense script
* disabling env flag suppresses everything

⸻

UX Rules

Ad blocks should look boring and contained.

Use:

* subtle “Advertisement” label
* reserved height
* no huge fogged background
* no sticky ads in v1
* no video ads
* no interstitials
* no anchor ads until we trust the experience

For mobile:

* feed ad max width 100%
* horizontal slot after content blocks
* no ads between tap/reveal controls and revealed data

For desktop:

* maybe right rail later, but not v1 unless layout already supports it cleanly

⸻

Testing Plan

Unit tests

Test:

shouldShowAds(null) === true when enabled
shouldShowAds({ isPaid: true }) === false
shouldShowAds({ isAdmin: true }) === false
shouldShowAds({ suppressAds: true }) === false
missing client ID === false
env disabled === false

Component tests

Verify:

* AdBoundary renders children for free viewer
* AdBoundary renders nothing for paid/admin viewer
* AdSlot does not crash without window.adsbygoogle
* AdSlot reserves layout space

Manual QA

Check:

* home page logged out
* home page paid user
* game detail logged out
* game detail paid user
* FairBet logged out
* FairBet paid user
* mobile viewport
* reveal mode on/off
* no score/data layout shifts
* no ad inside PBP
* no ad inside FairBet bet rows

Browser/network validation

For paid/admin:

* search Network tab for adsbygoogle
* should be zero

For free:

* script should load only when env config exists

⸻

Post-Implementation Doc Requirement

Create:

docs/ADS_SETUP.md

It must include:

1. How to create or use the AdSense account.
2. How to add the Scroll Down Sports domain.
3. How to find the publisher/client ID.
4. How to create manual ad units.
5. Which env var each ad unit maps to.
6. How to configure ads.txt.
7. How to verify https://scrolldownsports.dev/ads.txt.
8. How to disable ads globally.
9. How paid-user suppression works.
10. How to test that paid users do not load the ad script.
11. What not to enable yet:
    * Auto ads
    * anchors
    * vignettes
    * popups/interstitials
    * ads inside betting rows
    * ads inside PBP

⸻

Suggested ADS_SETUP.md Outline

# Ads Setup
## Current Strategy
Scroll Down Web uses manual Google AdSense ad units for free users only. Paid, admin, and suppressAds users do not render ad slots and do not load the AdSense script.
## Required Environment Variables
...
## AdSense Account Setup
...
## Domain Setup
...
## ads.txt Setup
...
## Creating Ad Units
...
## Slot Mapping
...
## Local Development
...
## Production Verification
...
## Paid User Verification
...
## Rollback
Set NEXT_PUBLIC_ADS_ENABLED=false and redeploy.
## Future Options
Auto ads can be tested later, but only after the manual placement version is stable.

⸻

Rollout Plan

Phase 1 — plumbing only

* add config
* add entitlement check
* add components
* add env vars
* add docs stub
* no visible ads unless env enabled

Phase 2 — safe placements

* home feed ad
* game detail section break ad
* FairBet bottom ad only

Phase 3 — account setup doc

* complete docs/ADS_SETUP.md
* include screenshots/notes where useful
* document exact AdSense slot mapping

Phase 4 — validation

* free user sees ad containers
* paid user sees none
* no AdSense script for paid/admin
* no layout shift around critical game data

⸻

Acceptance Criteria

Implementation is done when:

* There is a single ad entitlement function.
* Ads are controlled by env config.
* Paid/admin users do not load AdSense scripts.
* Free users can see manual ad units when configured.
* App works normally with ads disabled.
* No ads appear inside core game data, PBP, odds rows, or FairBet EV rows.
* ads.txt is available at the domain root.
* docs/ADS_SETUP.md fully explains account setup, repo config, deployment, verification, and rollback.
* Tests cover entitlement behavior.
* Manual QA confirms reveal gating and score trust are unaffected.

⸻

My Bias

Start boring.

One or two clean manual placements are better than squeezing every free user for pennies and making the app feel cheap. The whole point of Scroll Down is fast, trusted sports context. Ads should be the free-user tax, not the product.