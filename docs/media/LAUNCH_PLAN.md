# Launch plan

Rewritten 2026-11-15 for the agreed idea ([STRATEGY.md](STRATEGY.md)). Dates are relative to **D-day = the day the
first outlet publishes**. The owner sets D-day.

## Suggested window

**A quiet run in December and early January, D-day in the second half of January 2027, the couple story for
Valentine's Day.**

- The card (070), the retiree profile (069) and the beach fix are done. The hosting (A1), the analytics (A2) and most of the contact route are not started.
- From the long weekend of 6–8 December to 6 January newsrooms are thin: bad for agreeing a date with an outlet,
  fine for a quiet run with real people.
- The quiet run is the only way to learn, before the press sees it, whether people pass the card on and where the
  data is wrong.
- Valentine's Day (14 February) is a ready hook for the couple story (M2), two to three weeks after D-day; Sant
  Jordi (23 April) is the next.

Rule rather than date: D-day is about three weeks after everything in the checklist is done, and not between
20 December and 7 January. If something slips, D-day moves.

## Sequence

| When | What |
|---|---|
| D−8 to D−5 weeks | A1 hosting, A2 analytics (the only blockers still not started). 070 (card), 069 (retiree profile) and the "beach" data fix are done; recompute the sea numbers |
| D−5 to D−3 weeks | Contact route for time2map: credit, "Want a map like this?", "I want my city", case-study page. Native read-through of CA and ES. Method page |
| D−4 weeks | **Quiet run:** friends, two or three local groups, one post in a small community. Watch: do people reach a card, do they save or share it, what do they say is wrong |
| D−3 weeks | Fix what the quiet run showed. Recompute the numbers for M3 and M4 with the app's scoring. First look offered to one outlet. Submit the app to the Open Data BCN and datos.gob.es reuse catalogues |
| D−2 weeks | Write the pieces: method note, Q&A, example cards, the 73 barri notes (generated, read by a person), r/Barcelona post, short videos. Load test |
| D−1 week | Check link previews in WhatsApp, Telegram and X (still open in 063). Dry run of the whole path on a mid-range phone |
| **D-day** | M1 is out. r/Barcelona post and social the same day. Someone watches the dashboards and answers all day |
| D+1 to D+2 | The pack to the other city desks, broadcast, Catalan digital media and Spanish aggregators |
| D+3 to D+10 | M3 barri notes to the barri press, district by district. LinkedIn post (M6) with the coverage |
| D+1 to D+2 weeks | **Direct letters** to possible clients, with links to the coverage |
| D+2 weeks | Review against the metrics: contacts first, then visits and shares |
| Week of 14 February | M2, the couple: radio, lifestyle, short video |
| after | Wave 2 (people choosing where to live). A3 own basemap, then wave 3 (makers). Sant Jordi: M2 again |

## Checklist before the first press link

### The site

- [ ] A1 ([TODO-054](../features/TODO-054-cdn-hosting-burst-traffic.md), planned, not started): CDN cache and our origin are live; the final domain serves the site; GitHub Pages is a cold spare
- [ ] A2 ([TODO-056](../features/TODO-056-observability.md), planned, not started): analytics with UTM sources, error tracking, uptime alert to a phone
- [ ] Load test passed at the A1 target; third-party calls are listed and each has a fallback
- [ ] From a link to a building card in under a minute on a mid-range phone on mobile data; the card itself opens
      in under 3 seconds

### The product

- [x] [070](../features/070-building-rank-in-barri-and-city.md): the score is named as the match with the
      person's conditions; an award ("better than N% of homes in the barri / in the city") where the building
      stands out; the technical details are folded; the awards are on the share picture
- [x] [069](../features/069-retiree-profile-replaces-investor.md): retiree profile instead of investor (in code;
      its ES and CA texts wait for the native read-through below)
- [x] "Beach" fixed (2026-11-15, `bb7e495`, PR #69): an asphalt pool deck in Nou Barris was tagged
      `natural=beach` in OpenStreetMap. The pipeline now skips paved surfaces, a check fails if Porta, Sant Andreu or
      la Prosperitat get a beach score, and the shipped blob is cleaned (5,813 buildings). The beach is also off by
      default in the conditions since 073. **Every sea number in M2 and M4 was computed before the fix: recompute.**
- [ ] Native read-through of ES and CA, including the new card texts
- [ ] Link previews verified in WhatsApp, Telegram, X, Facebook, LinkedIn (built in 063; can only be checked after the first deploy on the final domain)

### Contacts for time2map

The traffic is for the company: the result that counts is contacts of people who want a map made. None of this
exists yet.

- [ ] **"Made by time2map" credit** in the product, on every share picture and in any embed, linking to the company.
      Partly there: "Made by time2map" in the About dialog and "Visit time2map.com" in the brand bar. The share
      picture prints only the site address (`livability.time2map.com`), not a credit to the company
- [x] **A way to ask for a map**: "Want a map like this for your city or company?" in the About dialog, leading to
      time2map.com with the place in `utm_medium` ([029](../features/029-cta-subscribe-contact.md)). Still to do: point
      `VITE_CTA_URL` at the case-study page when it exists
- [ ] **Case-study page** on the company site (M6): what was built, from which data, what it can be adapted to
- [ ] **"How it was made" write-up** ready for LinkedIn and for talks
- [ ] **"I want my city" button** with a tick box "I represent a company or an organisation" and a contact field
- [ ] **Direct letters prepared**: the list of recipients by field (real estate and tourism companies,
      environmental consultancies and NGOs, mining and infrastructure firms, newsrooms) and the outline of each
      letter. The public sector is not the first target
- [ ] Requests are counted in the analytics by source (form, button, email)

### The stories

- [ ] Every number recomputed with the app's scoring from the shipped data version and checked by hand on ten
      buildings
- [ ] Method page public: sources, year, model limits, what is not measured. Only the "Known limits" block in the
      info dialog exists (`info.json`); no public page
- [ ] Example cards and example couples chosen with a local's eye (no result that residents would laugh at)
- [ ] Credits on every picture; no "official", no publisher logos; nothing built on street flooding
- [ ] Q&A ready: who made this, who pays, why does my building score low, what is not measured, can I reuse it,
      can you make one for us
- [ ] One named person answers press and comments on D-day and the two days after

## Hooks through 2027

Use a hook only with a story that fits it. Dates to confirm when planning.

| When | Hook | Story |
|---|---|---|
| January | New year, people think about moving | M1 |
| 14 February | Valentine's Day | M2, the couple |
| 23 April | Sant Jordi | M2 again, with what couples chose since February if the analytics show it |
| May 2027 | Municipal elections | nothing of our own in the campaign weeks; the same material to anyone who asks |
| June–September | Summer, the sea, terraces | M4 (the sea, once the data is fixed) |
| September | Back to school, moving season | M3 for families; M1 again |
| When ready | Free-text wishes read by an AI; "I don't agree" | the later-wave stories in STORIES.md |
| Any time | A new city or a client project built on the same method | M6: the second showcase |

## After each wave

- Contacts: how many, from where, what they asked for.
- What brought visits and links per hour of work; what brought nothing.
- The share rate, and where people drop between the first screen and the card.
- The questions people asked: each repeated one becomes a line in the UI or on the method page.
- Requests for other cities and features, logged for the roadmap.
