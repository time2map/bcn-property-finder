# Roadmap (2026-11-15)

Only what is **not done yet**. Done work is in the feature files (no `TODO-` prefix) and in
[FEATURES_OVERVIEW.md](FEATURES_OVERVIEW.md). This file gives the order and the dependencies; status lives in the
feature files. The media side (idea, stories, channels, week-by-week plan, checklist) is in
[`docs/media/`](media/README.md).

Architecture notes for the infrastructure items: `local-docs/architecture/` (not in git).

## Launch strategy (decided 2026-11-13, media side agreed 2026-11-15)

For a mass launch: **keep the current functionality, work on reach.** No gated feature is switched on for the
launch. First wave is residents, in a light tone.

The launch story: say what matters to you, tap any building, see how well it fits you and how it ranks, for your
conditions, in its barri and in the city. The traffic is for client contacts for time2map, not visits.

### Why reach, not breadth

Walk Score, Hoodmaps, Chronotrains and the BBC "Where can I afford to live?" calculator spread because of reach:

- **One idea in one sentence.**
- **A personal result in 10 seconds.** The person sees something about their own place.
- **A result worth sharing or arguing about.** "My barri is 3rd" touches identity.
- **The press needs a story, not a tool.** "The 10 quietest barris of Barcelona" gets written.
- **Traffic comes from phones, from a link, in one spike.** Anyone who waits more than ~3 s or hits an error is lost.

### Why not the gated features

`ISOCHRONE`, `PINS`, `SCREENSHOT`, `EXCLUSIONS` serve the second mode (comparing listings already found): the bottom
of the funnel. `ISOCHRONE` and `SCREENSHOT` also need a server or a secret key, a new point of failure at the traffic
peak. They stay as reasons for a second and third wave ("now with your commute"). Multi-city (033), green index
(040), market activity (041) and the other "Later" items wait until the launch shows what people ask for.

### Positioning

"A map for foreigners to buy a home in Barcelona" can go the wrong way during the housing crisis. The framing is
"how liveable is your street", addressed to residents. Buyers still find the product.

## Features for the launch

The minimum before any press link: **A1 (hosting) + A2 (observability)**. Everything else in the table can follow,
in the order given.

### Infrastructure (scale)

| Order | Feature | Depends on | Why |
|---|---|---|---|
| A1 | [TODO-054](features/TODO-054-cdn-hosting-burst-traffic.md) hosting: CDN cache, our server as origin, versioned data | — | GitHub Pages cannot take a spike; also needed for link previews (063 L1b) and the widget (L3) |
| A2 | [TODO-056](features/TODO-056-observability.md) observability: analytics with UTM sources, errors, uptime, data version | — (self-hosted parts need A1's server) | can't run a launch blind; counts the contact requests |
| A3 | [TODO-055](features/TODO-055-static-third-party-dependencies.md) own basemap, static metro, Catastro offline | A1 | third-party servers are the next thing to break; before Show HN |
| A4 | [TODO-057](features/TODO-057-ci-gate-previews-data-out-of-git.md) CI gate, branch previews, data out of git | A1 | safe hotfixes under load |
| A5 | [TODO-058](features/TODO-058-frontend-performance-budget.md) remainder: cache headers, Lighthouse ≥ 80, a real low-end phone | A1 | mobile traffic from press |
| — | [TODO-059](features/TODO-059-edge-api-personal-mode.md) API for the personal mode | A1 | design only; when isochrones go public |

### Product and content

| Order | Item | Depends on | Notes |
|---|---|---|---|
| L1b | Link previews verified in WhatsApp, Telegram, X, Facebook, LinkedIn | A1 | the share image itself is done (063); static hosting cannot set per-URL meta tags |
| — | "Beach" data fix: inland barris (Porta, Sant Andreu, la Prosperitat) must not come out as near a beach | — | found 2026-11-14; the pipeline counts every OSM `natural=beach` polygon. Cause: an asphalt pool deck in Nou Barris (way 1202318704). Code fix 2026-11-15 (paved `surface` filtered); data needs a rerun |
| — | Native read-through of ES and CA, including the card texts | — | 065, 069, 070 |
| — | Contact route for time2map: "Made by time2map" credit on share pictures, "I want my city" button, case-study page, "how it was made" write-up, direct letters | — | the "Want a map like this?" invitation in About is done (029); checklist in [LAUNCH_PLAN](media/LAUNCH_PLAN.md) |
| L5 | 2–3 press stories built from our own data (quietest barris, everything within 10 min on foot, price vs. liveability) | — | no code, a data note; numbers recomputed with the app's scoring, see [STORIES](media/STORIES.md) |
| L3 | **Embeddable widget** for real-estate agencies | A1, licence check | a later wave; see below. File not written yet |
| — | Landing page | after the above | [TODO-030](features/TODO-030-landing-page.md), stays later: viral traffic goes straight into the map, an extra screen only loses it |

#### L3. Embeddable widget for agencies

An agency puts a small, good-looking block of ours on its own listing page: for the listing's address, the
livability score, the band and a short list of the conditions, plus a link "see on the map". Each embed is a
permanent backlink and a free distribution channel. Options (first pick is the cheapest):

1. **iframe** of a stripped-down page (`/embed?lat=…&lng=…`): no panel, one card, no account. One line of HTML for
   the agency. Needs framing to be allowed (`frame-ancestors`), which GitHub Pages cannot set, so it depends on A1.
2. **Static image / badge** (reuses the share image, 063): an `<img>` per address, works anywhere, nothing to run
   on the agency side, but not interactive.
3. **Web component / script tag** (`<bcn-livability lat lng>`): nicer for agencies, more to maintain; later.

Conditions: the widget always links back to the map (this is the point of it); it must not leak the user's
settings; it must be cheap to serve under load (precomputed per building where possible).
**Open risk:** the data licences must allow showing derived scores on commercial sites. Check every source in
[DATA_LICENSES.md](DATA_LICENSES.md) before this ships, and the Idealista links must stay out of the widget.

## Later (unordered)

TODO-030 landing page, TODO-033 multi-city, TODO-040 green index, TODO-041 market activity,
TODO-043 noise outside Barcelona, TODO-048 energy certificates.

## Dropped

- **Address-first entry (was L4)**, dropped 2026-11-15. The search box (044) and the profile-first onboarding
  (031, 068) already give a personal result fast; the launch story starts from the conditions, not from an address.
