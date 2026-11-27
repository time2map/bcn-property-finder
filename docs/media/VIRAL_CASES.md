# What made comparable projects spread

Researched 2026-11-14. "Verified" means the facts come from the linked source, read on that date. "From memory"
means a well-known case that was not re-checked: use it as a pattern, do not quote its numbers.

## Cases

### 1. NYT dialect quiz, 2013 (verified)

- Published 21 December 2013 and became the most-visited piece on nytimes.com for the whole year in 11 days. Built
  by an intern on top of an academic survey.
- Mechanic: 25 questions, then a personal map ("your speech is closest to these three cities"). People posted the
  result, not the article: "I got Cleveland!".
- **Lesson:** the unit that spreads is a personal result that says something about the person's identity. Serious
  data, playful entry. The result fits in three words.
- Sources: [Mediaite](https://www.mediaite.com/online/the-ny-times-most-visited-post-of-2013-was-created-by-an-intern),
  [HuffPost](https://www.huffpost.com/entry/new-york-times-intern-dialect-map-popular-josh-katz_n_4636941),
  [Peabody](https://peabodyawards.com/award-profile/how-yall-youse-and-you-guys-talk-ny-times-dialect-quiz-2013/)

### 2. Hoodmaps, 2017 (verified, the author's own write-up)

- Launch day: over 200,000 users, about half a million visits.
- Order of channels: embedded on an existing product for months → **a local subreddit first** (someone posted the
  Los Angeles map to r/LosAngeles and it took off before any launch) → Product Hunt #1 for 24 h → Show HN top for
  a day → r/dataisbeautiful #1 → Reddit front page.
- The Reddit title was personal and modest ("I made a site that…") and used the subreddit's own vocabulary. The
  author answered every comment with method and data sources.
- **What went wrong:** the server died under about 500 writes per second during the Reddit surge, and the upvotes
  stalled while it was down. The map provider's free quota ran out mid-launch; unlocking it was quoted at $10,000.
  He rewrote to static pages and another map provider within hours.
- **Lessons:** a city's own community is the first match, global channels come after. One outage during the spike
  costs the spike. Third-party quotas are a launch risk (this is exactly TODO-054 and TODO-055).
- Source: [levels.io/hoodmaps](https://levels.io/hoodmaps)

### 3. Chronotrains, 2022 (verified)

- Built in a week by one developer; over a million views; spread while the author was on holiday.
- One sentence: "how far can you go by train in 5 hours". Hover a station, get the answer for your own city.
- Picked up by Le Figaro, Big Think (Strange Maps), Maps Mania, The Map Room; politicians used screenshots to argue
  about rail investment.
- Survived because it was static pages behind a CDN cache.
- **Lessons:** the screenshot is the unit of distribution, and each city's screenshot is a separate local story.
  A tool that feeds an existing public argument gets carried by both sides.
- Sources: [Vercel write-up (summary)](https://www.plushcap.com/content/vercel/blog/building-a-viral-application-to-visualize-train-routes),
  [The Map Room](https://www.maproomblog.com/2022/08/how-far-you-can-go-in-five-hours-or-on-a-single-train/),
  [Connexion France](https://connexionfrance.com/practical/how-far-can-you-get-by-train-in-five-hours-from-near-you-in-france/130465)

### 4. The Barcelona noise map on r/Barcelona, 2022 (verified, and it is our own data)

- A Reddit user posted a picture of Barcelona's strategic noise map to r/Barcelona with one line: "Cities aren't
  loud, cars are." Xataka Magnet turned it into an article on noise as a public-health problem (31 October 2022).
- No tool, no interactivity: one image of the same open dataset we use, plus one sentence with a point of view.
- **Lessons:** Barcelona noise is a proven subject, and the path r/Barcelona → Spanish aggregator works. What
  travelled was the sentence. We have what that post did not: the answer for the reader's own building.
- Source: [Xataka Magnet](https://www.xataka.com/magnet/ciudades-no-ruidosas-coches-este-mapa-barcelona-mejor-prueba)

### 5. "Calle a calle" pieces in the Spanish press (verified that the format recurs; no traffic figures found)

- El País, elDiario.es and others publish the INE household income atlas as a street-level map every year ("How
  rich are your neighbours?"), and a block-level rent map in 2020. Each edition is re-reported by Xataka, Newtral,
  El Debate, Vozpópuli and regional papers.
- **Lessons:** "look up your street" is a format Spanish newsrooms already know how to sell, and they re-run it.
  The lookup lives inside the article. An outlet wants the interactive on its own page, not a link out: this is
  the case for a media embed (STRATEGY.md, product work).
- Sources: [Xataka Magnet](https://xataka.com/magnet/como-ricos-tus-vecinos-mapa-renta-espanoles-calle-a-calle),
  [Newtral](https://www.newtral.es/renta-espana-mapa-calle-a-calle/20251023/),
  [rent map, 2020](https://housing-base.journalismarena.eu/access-to-housing/data-sources-sets-and-visualisations/viz-rental-prices-by-block-in-spain-el-pais-eldiario-july-2020)

### 6. Building-age maps (from memory)

- "Every building coloured by the year it was built" has gone round several times (the Netherlands, Brooklyn,
  Portland, Paris). No argument, no personal result: a beautiful picture in which people look for their own house.
- **Lesson:** a second, purely visual asset reaches map communities that ignore "tools". We already have year
  built for about 174k buildings.

### 7. Walk Score (from memory)

- One number per address, and a badge that listing sites embedded. The embed was the growth engine and the
  business. This is the model for the agency widget (ROADMAP L3), a later wave.

## Companies that won attention for paid work with a free public product

Researched 2026-11-14 (second round), because the purpose of our traffic is client contacts for time2map.

### 8. The Pudding and Polygraph (verified)

- The Pudding publishes free visual essays; its sister studio Polygraph is "a for-hire visual storytelling agency
  that sustains our work on The Pudding". In 2017 a handful of client projects paid for the whole editorial side.
  Clients named: YouTube, Universal Music Group.
- Its biggest hit, "How Bad Is Your Spotify?" (2020): a bot with an attitude judges your music library. #1 trending
  on Twitter, millions of views, crashed repeatedly under load. People posted screenshots of the verdict.
- **Lessons:** the free thing is the portfolio. The hit was light, personal and funny, with a voice. The verdict
  text was the shared unit.
- Sources: [Nieman Lab, 2017](https://www.niemanlab.org/2017/05/este-site-publica-visualizacoes-de-dados-altamente-interactivos-e-tem-um-negocio-que-o-sustenta/),
  [polygraph.cool/faq](https://polygraph.cool/faq), [Wikipedia](https://en.wikipedia.org/wiki/How_Bad_Is_Your_Spotify%3F),
  [Mike Lacher's project page](https://mikelacher.com/work/how-bad-is-your-spotify)

### 9. Datawheel: the OEC and Tradle (verified; numbers are the company's own)

- Datawheel builds data platforms to order. Its trade-data site, the OEC, got a Wordle-style daily game, Tradle
  (2022): guess the country from its exports. Over 4 million sessions; about half a million views a month.
- Datawheel now has a service page, "Data games that build communities and knowledge", built on that result.
- **Lesson:** the closest parallel to us: a B2B data company, a playful public product on its own data, and then
  the same thing sold as a service.
- Sources: [Datawheel](https://datawheel.us/data-gamification), [Marketplace](https://marketplace.org/2023/08/24/tradle-brings-wordle-style-game-to-global-exports),
  [Automaton](https://automaton-media.com/en/news/20220311-10472/)

### 10. Crew and Unsplash (verified)

- Crew, a freelancer marketplace with three months of cash left (2013), put ten free photos on a $19 blog theme in
  a few hours. The side project sent over 5 million visitors to Crew, then outgrew it; Crew was later sold.
- **Lessons:** a small free thing can bring more than the product's own marketing. It can also become the company.
- Sources: [The Next Web, 2014](https://thenextweb.com/news/side-projects-saved-our-startup),
  [freeCodeCamp](https://www.freecodecamp.org/news/the-unsplash-formula-how-crew-went-from-almost-broke-to-getting-5-million-visitors-ec4db8e7d6cd/)

### 11. Radio Garden (verified, no traffic figure)

- A globe of live radio stations, made by Studio Puckey and Moniker for a research project of the Netherlands
  Institute for Sound and Vision (2016). "Shared like crazy" within a week (NPR); it is now a company of its own.
- **Lesson:** a commissioned map can be the studio's best advertisement, if the studio's name stays on it.
- Sources: [Sound and Vision](https://labs.beeldengeluid.nl/archive/radio-garden), [Studio Moniker](https://studiomoniker.com/projects/radio-garden),
  [NPR via LAist](https://laist.com/news/npr-news/jonathan-puckeys-radio-garden-knows-no-borders)

### 12. Same format as ours, in the press: NYT "Where Should You Live?" (2021, verified)

- NYT Opinion calculator: the reader weights priorities, each place scores 0–10 per metric, the tool names the
  places that fit. Data from the Census Bureau, Realtor.com, AccuWeather, Yelp.
- **Lesson:** "set what matters to you, get a place" is a format a major newsroom chose to build. Ours does it at
  the level of a building.
- Sources: [FlowingData](https://flowingdata.com/2021/11/24/calculating-where-you-should-live/),
  [Apartment Therapy](https://www.apartmenttherapy.com/what-u-s-city-should-you-be-living-in-250322)

### 13. Couples: Partner Planner (found, not opened)

- [getwherenext.com/tools/partner-planner](https://getwherenext.com/tools/partner-planner): each partner sets
  priorities in 7 dimensions; the tool shows blended scores, agreement levels and dealbreaker flags for 95
  countries. Country scale only. Nothing found that does this for streets or barris.

### 14. Vivino: a general rating, a personal match, and a rank (owner's reference, 2026-11-15)

- A wine page shows three different things: the **average rating** of the wine (the same for everyone), **"Match
  for You"** (a personal score, 0–100%, shown once the person has rated five wines: 70–100% a great match, 40–70%
  average, below 40% low), and **rank badges** ("among the top N% of all wines in the world", "of the region").
  The first two are verified from Vivino's own announcement; the rank wording is from the owner's and our memory of
  the app, not re-checked.
- **Lessons for us:** a number that is the same for everyone can be compared and passed on; the personal match is
  what makes the tool useful; the rank turns a score into a statement. "Among the top N%" also reads well when
  many items share the top score. Vivino's general rating comes from its users; ours can only be the score under
  typical conditions, and must be named that way.
- Source: [Vivino: Introducing Match for You](https://www.vivino.com/wine-news/introducing-match-for-you)

### What is in fashion in 2026

- **A verdict with a voice.** AI "roast" and "wrapped" tools keep going round ("roast my Wrapped" went viral again
  in February 2026). An observation from that coverage: the ones that spread had no sales pitch attached.
  Sources: [New Robot Overlords](https://newrobotoverlords.com/article/bot-that-roasts-spotify-wrapped),
  [Failory on AI growth loops](https://newsletter.failory.com/p/ai-powered-growth-loops)
- **Talking to the map.** Google launched Ask Maps (March 2026), Felt launched Felt AI (June 2026), Esri has AI
  chat in beta in ArcGIS Online (November 2026); CARTO and Mapbox have their own. Plain-language questions to
  geodata are what map buyers are being shown this year.
  Sources: [Esri](https://www.esri.com/arcgis-blog/products/arcgis/geoai/whats-new-in-geospatial-ai-november-2026),
  [Felt](https://felt.com/blog/a-brand-new-era-of-gis),
  [Project Geospatial](https://projectgeospatial.org/geospatial-frontiers/talk-to-the-map-is-natural-language-gis-the-next-public-geoportal-interface)

### What the company cases share

1. The free thing is something people use or play with, not an advertisement. No pitch inside it.
2. All of them are light. None is about a crisis.
3. The company is one click away, and what it sells is the same skill, visibly.
4. It is rarely one hit: The Pudding is a publication, Datawheel made several games. Plan a second showcase in
   another field (environment, tourism) to show the range.

### How the companies put themselves next to the free product (checked 2026-11-15)

Pages opened by hand; where a page did not give its footer, it says "not seen", which is not the same as "absent".

| Who | In the free product | Where the invitation to work together sits |
|---|---|---|
| Datawheel (Tradle on oec.world) | No credit to Datawheel, no contact on the game page | A separate service page, [datawheel.us/data-gamification](https://datawheel.us/data-gamification): the numbers (4M+ sessions, 500k players a month), then "Let's Talk" near the end; Contact in the header and footer |
| The Pudding / Polygraph | Editorial work carries no brand or client; "the only time a brand finds its way on The Pudding" is a labelled sponsorship | A "Content Studio" section on [pudding.cool/about](https://pudding.cool/about/): white-labelled custom work through Polygraph, with an email. [polygraph.cool](https://polygraph.cool) has "Project Inquiries" with an email in its footer; no "hire us" wording. A section on the About page explains that Polygraph pays for The Pudding |
| Hoodmaps | No author, About or credit seen on the main page (footer not seen) | not seen |
| Radio Garden | No studio credit seen on the main page (About page not checked) | not seen |

What to take from it:

1. **Quiet in the product, loud on a separate page.** The free product carries at most a small credit; the selling
   happens on a page the credit links to.
2. **Soft wording:** "Let's Talk", "Project Inquiries", a plain email. Nobody writes "Hire us".
3. **An honest About works.** The Pudding says openly who pays for what and that clients do not steer the editorial
   work. For us: one About section saying that time2map built the map and builds maps to order.
4. **No pitch inside the map** in any case found. Matches the rule in [CHANNELS.md](CHANNELS.md).

## What people actually passed on: results about a place (third round, 2026-11-16)

Researched because the owner asked whether "a result worth forwarding" has worked elsewhere for places and homes.
Facts come from search summaries of the linked sources unless marked "opened". Traffic figures are views or uses;
**no source gives a count of shared results**, the evidence of sharing is anecdotal everywhere.

### A. Spread by the result (the result is a name, and it is about the person)

| Case | The result a person got | Size | Source |
|---|---|---|---|
| BuzzFeed, "What City Should You Actually Live In?" (2014) | One of nine cities: "I got Portland" | over 20 million views; no data behind it | [Nieman Lab (opened)](https://www.niemanlab.org/2014/02/are-quizzes-the-new-lists-what-buzzfeeds-latest-viral-success-means-for-publishing/) |
| BBC, Great British Class Calculator (2013) | One of seven named classes ("Precariat", "Elite") | about 7 million in the first week, about 9 million by the end of 2014; built on a survey of 161,000 | [LSE slides](https://www.lse.ac.uk/International-Inequalities/Assets/Documents/Slides/Class-in-the-21st-century-slides.pdf), [Information is Beautiful Awards](https://www.informationisbeautifulawards.com/projects/341-the-great-british-class-calculator-what-class-are-you) |
| BBC, "Where in Britain would you be happiest?" (2015) | A named district and a predicted life satisfaction in %, next to the place you live now | no figure found; tool retired | [Cambridge](https://www.cam.ac.uk/research/news/study-finds-gbs-most-extroverted-agreeable-and-emotionally-stable-regions) |
| NYT, "Do You Live in a Political Bubble?" (2021) | Enter an address: a dot picture of how your 1,000 nearest neighbours voted | no figure; "Twitter deluged with screenshots" (one writer) | [FlowingData](https://flowingdata.com/2021/05/05/see-if-you-live-in-a-political-bubble/) |
| NYT, "How Much Hotter Is Your Hometown Than When You Were Born?" (2018) | Hometown and birth year: one number about your own life | in the Most Popular module; "a lot of organic sharing" of hometown results | [journalism.co.uk](https://journalism.co.uk/news/nyt-uses-data-visualisation-to-bring-climate-change-home-literally-/s2/a727570) |
| Wahl-O-Mat, Germany (2025) | Your answers to 38 theses: % match with each party | 26 million uses for one election | [bpb press release](https://www.bpb.de/system/files/dokument_pdf/PM_Wahl-O-Mat_zur_Bundestagswahl_2025_uebertrifft_bisherigen_Nutzungsrekord_final.pdf?download=1) |

BuzzFeed's editor on why (Nieman Lab, opened): "When people share things, it's partially because of what it says about
them. Quizzes are like the literal version of all that." Results were kept "more pleasant than dire".

### B. Our format: set what matters, get the places that fit

| Case | What it is | What carried it | Source |
|---|---|---|---|
| Close.city (2024) | Pick amenities, see walking time to the furthest of them for every block in the US. Made by one person, Nat Henry of Henry Spatial Analysis (a geodata consultancy: the same play as ours) | over 1 million page views in the first week. Local outlets each wrote "how walkable is our city" (Seattle, Boston, Detroit, Tri-Cities) | [Streetsblog Mass](https://mass.streetsblog.org/2024/04/19/close-city-maps-illustrate-inequalities-of-access-to-vital-services-across-the-boston-region), [Maps Mania](https://googlemapsmania.blogspot.com/2024/04/15-minute-us-cities.html) |
| BBC Newsbeat, "Know Your Place" (2019) | Under-26s choose what matters, get the local authorities that fit; 11 variables | Local papers each ran their own rank ("Melton ranked worst", "Northampton one of the better") and polls "do you agree?" | [Melton Times](https://www.meltontimes.co.uk/news/politics/melton-ranked-worst-place-live-people-aged-under-26-125809), [Lynn News](https://lynnnews.co.uk/news/poll-do-you-agree-with-a-bbc-survey-which-makes-west-norfolk-below-average-for-those-under-the-age-of-26-9061331) |
| Vancouver Magazine, "Find Your Neighbourhood" (2016) | Readers weight green space, price, schools, crime over 39 neighbourhoods | Covered by Global News, CTV, HuffPost; rerun in 2018; no traffic figure | [Global News](https://globalnews.ca/news/2591911/new-online-tool-ranks-vancouvers-best-neighbourhoods/) |
| Ville de Rêve, France (yearly since about 2021) | A town for your criteria, from 150 public sources | The yearly ranking is re-reported by national and local press every January | [Connexion](https://www.connexionfrance.com/magazine/interview-how-we-determine-the-right-town-for-you-in-france/715074), [data.gouv.fr reuse](https://www.data.gouv.fr/reuses/65392e0999bd1e8186e699de) |
| NYT "Where Should You Live?" (2021) | case 12 above | | |

### Barcelona

- Time Out (2025) and Ara ran "the best barris to live in according to ChatGPT / to an AI"; Barcelona Secreta has a
  piece on the Hoodmaps stereotype map of the city (title only, page not read). The local press publishes barri
  identity content that has no data behind it. No "which barri are you" tool with data was found.

### What follows

1. **Nothing in group B is shown to have spread through shared results.** Our format gets press, and local press
   multiplies it place by place (this supports M3, the note per barri). It is not proof that people forward a card.
2. **Every result in group A is a name or a picture of the person's own surroundings, never a score of an object.**
   "I got Portland", "I am Precariat", "my bubble". It comes from a short closed list, so two people can compare.
3. **The result can be argued with.** The class calculator and "Know Your Place" spread on "do you agree?".
4. **The closest structural twin is the Wahl-O-Mat:** own positions in, % match with each option out. What people
   quote is the option that came first, not the percentage.
5. Our card says "this building: 83 for my conditions". By this evidence the forwardable unit would be the name of a
   place the person's conditions point to ("my conditions say el Poblenou; I live in Gràcia"). Not agreed with the
   owner; it touches decisions in STRATEGY.md (no additions beyond the two awards; no single score for a barri).

## The pattern

| # | What the cases share | Where we stand |
|---|---|---|
| 1 | One sentence that a stranger can repeat | Missing. "A livability map with conditions" is not it |
| 2 | A personal result within 10 seconds, without configuring anything | Partly: search exists (044), but the first screen is conditions, not the address |
| 3 | The result compares the person with others (a city, a rank, a percentile) | Missing. "Meets 3 of 4 conditions" has no "compared with whom" |
| 4 | A picture that carries the result on its own | Done (063, 064) |
| 5 | A story with a point of view for the press, separate from the tool | Missing: no computed numbers yet |
| 6 | The first push comes from the place's own community, then aggregators, then global | Planned in CHANNELS.md |
| 7 | The site stays up during the one spike | Not yet: A1, A2 |
| 8 | The outlet can put the lookup inside its own article | Missing: no embed |

Rows 1, 3, 5 and 8 are the gap between "a good tool" and "something that spreads". The table shows the state on
2026-11-14; how the agreed idea closes each row is in the table "Why this form" in [STRATEGY.md](STRATEGY.md).
Row 8 (an embed for outlets) is not part of the launch.

## What nobody can promise

None of these authors could plan the size of the spike. Hoodmaps had an existing audience; the dialect quiz had
nytimes.com. What a plan can do is take several independent shots, each cheap, and make sure the site and the
share mechanic are ready when one lands. The numbers in STRATEGY.md are ranges, not forecasts.
