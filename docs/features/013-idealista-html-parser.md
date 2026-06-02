# Feature 013 — Idealista HTML Parser

## Goal

Allow users to import a property from Idealista by saving the listing page as an HTML file and dropping it onto the map or uploading it via the + menu. The parser extracts all available structured data without requiring API access or scraping.

## User flow

1. User opens a property listing on idealista.com in the browser.
2. User saves the page as HTML (`File → Save Page As… → Webpage, HTML Only`).
3. User imports the file via one of two paths:
   - **Drag & drop**: drag the `.html` file anywhere over the map.
   - **+ menu → Import Idealista HTML**: opens a file picker dialog.
4. The parser extracts property data, geocodes the address, and creates a `PropertyPin` on the map.
5. A "Drop Idealista page here" overlay appears while dragging; a spinner shows "Importing Idealista listing…" while processing.
6. If geocoding falls back to approximate coordinates (neighborhood only), an amber "Address is approximate" banner appears — the user can drag the pin to the correct spot.

---

## Data model

### Step 1 — Parser output: `IdealistaProperty`

Intermediate type returned by the parser (`src/types/IdealistaProperty.ts`). Contains everything extractable from the HTML.

```typescript
interface IdealistaProperty {
  // Identification
  id: string            // "110784254" — extracted from og:url
  url: string           // "https://www.idealista.com/en/inmueble/110784254/"

  // Price
  price: number         // 379000
  pricePerSqm: number   // 5922

  // Size & layout
  areaSqm: number       // 64
  bedrooms: number      // 2
  bathrooms: number     // 1

  // Location
  street: string        // "Calle de Llull"
  neighborhood: string  // "La Vila Olímpica del Poblenou"
  city: string          // "Barcelona"

  // Building — separate fields
  floor: string         // "6th floor exterior"
  hasLift: boolean      // true
  yearBuilt: number | null  // 1974

  // Property details — separate fields
  orientation: string[]     // ["South", "East", "West"]
  condition: string         // "Second hand/good condition"
  amenities: string[]       // ["Air conditioning"]
  basicFeatures: string[]   // remaining items from "Basic features" section

  // Full description text
  description: string

  // Energy performance certificate
  energyConsumption: string | null  // "152 kWh/m² year"
  energyCO2: string | null          // "34 kg CO2/m²"

  // Photos — all XL-resolution URLs; photos[0] is the cover
  photos: string[]
}
```

### Step 2 — Target model: `PropertyPin`

`PropertyPin` (in `src/types/pins.ts`) extended with:

```typescript
bedrooms?: number   // 2
bathrooms?: number  // 1
floor?: string      // "6th floor exterior"
yearBuilt?: number  // 1974
```

Rich details (orientation, condition, amenities, description, energy) are stored in the existing `comment` field as formatted plain text — no new sub-objects needed.

### Mapping `IdealistaProperty` → `PropertyPin`

| `PropertyPin` field | Source |
|---------------------|--------|
| `id` | `crypto.randomUUID()` |
| `coordinates` | Geocoded from `street + neighborhood + city` via Nominatim |
| `price` | `IdealistaProperty.price` |
| `area` | `IdealistaProperty.areaSqm` |
| `url` | `IdealistaProperty.url` |
| `photos` | `IdealistaProperty.photos` |
| `bedrooms` | `IdealistaProperty.bedrooms` |
| `bathrooms` | `IdealistaProperty.bathrooms` |
| `floor` | `IdealistaProperty.floor` |
| `yearBuilt` | `IdealistaProperty.yearBuilt` |
| `comment` | Address + rich details as formatted plain text (see below) |
| `createdAt` | `new Date().toISOString()` |

`comment` format (auto-populated, user can edit afterward):

```
Calle de Llull, La Vila Olímpica del Poblenou

Orientation: South, East, West
Condition: Second hand/good condition
Amenities: Air conditioning, Balcony, Fitted wardrobes
Year: 1974 · Floor: 6th exterior · Lift: yes
Energy: 152 kWh/m² · 34 kg CO₂/m²

RFG Properties presents this spacious and sunny property…
```

---

## UI changes

### + button → 3-option menu (`AddPinButton`)

The floating `+` button now opens a Mantine `Menu` with three items:

- **Place on map** — activates pin-placement mode (cursor click on map)
- **Upload photo** — opens file picker for `image/*`; triggers screenshot OCR flow
- **Import Idealista HTML** — opens file picker for `.html,.htm`; triggers HTML import flow

When pin-placement mode is active the button shows `✕` (with tooltip); clicking it cancels.

### Drag & drop (`ScreenshotDropZone`)

`ScreenshotDropZone` wraps the map and handles drag events. It inspects the dragged file type during `dragover` (`dataTransfer.items[0]?.type`) and shows a contextual overlay:

- `image/*` → "Drop screenshot here"
- `text/html` → "Drop Idealista page here"

While processing, a spinner overlay shows `processingLabel` ("Importing Idealista listing…" for HTML, "Reading screenshot…" for images).

### Compare table — new columns

Added after the existing Area / €/m² columns:

| Column | Source | Format |
|--------|--------|--------|
| **Rooms** | `bedrooms` / `bathrooms` | `2 bd / 1 ba` |
| **Floor** | `floor` | plain text |
| **Year** | `yearBuilt` | number |

The **Comment** column has `min-width: 240px` and a vertically-resizable textarea (`min-height: 72px`) to comfortably display the auto-populated rich text block.

---

## Parsing strategy

| Field | Source in HTML |
|-------|---------------|
| `id`, `url` | `<meta property="og:url" content="…">` |
| `price` | `strong.price` — strip `,` → parseInt |
| `pricePerSqm` | `.flex-feature-details` containing `€/m²` |
| `areaSqm` | `.info-data` span before `m²`, or `li` "X m² built" |
| `bedrooms` | `li` matching /(\d+) bedrooms?/ |
| `bathrooms` | `li` matching /(\d+) bathrooms?/ |
| `street` | `h1 .main-info__title-main` — strip "Flat / apartment for sale in" prefix |
| `neighborhood`, `city` | `.main-info__title-minor` — split on last `,` |
| `floor` | `li` in Building section containing "floor" |
| `hasLift` | `li` "With lift" present in Building section |
| `yearBuilt` | `li` matching /Built in (\d{4})/ |
| `orientation` | `li` matching /Orientation (.+)/ → split on `,` |
| `condition` | `li` matching known condition strings |
| `amenities` | all `li` inside Amenities `div.details-property_features` |
| `basicFeatures` | remaining `li` in Basic features |
| `description` | `div.comment` inner text (or `#adCommentsLanguage`) |
| `energyConsumption` | first `span[class^="icon-energy-"]` |
| `energyCO2` | second `span[class^="icon-energy-"]` |
| `photos` | all unique URLs matching `WEB_DETAIL-XL-L` in `srcset` attrs |

Uses native browser `DOMParser` — no external dependencies.

---

## Geocoding

`coordinates` are not in the static HTML (injected dynamically by JS). After parsing, geocode via Nominatim:

```
GET https://nominatim.openstreetmap.org/search
  ?q={street}, {neighborhood}, {city}
  &format=json
  &limit=1
```

Falls back to `{neighborhood}, {city}` if the full address returns no result. If the fallback is used, `approxBanner` is set to `true` in `DropState`.

---

## Files

```
frontend/src/types/
  IdealistaProperty.ts          — IdealistaProperty interface
  pins.ts                       — PropertyPin extended with bedrooms/bathrooms/floor/yearBuilt

frontend/src/services/parser/
  IdealistaHTMLParser.ts        — parser class + buildPinComment()
  IdealistaHTMLParser.test.ts

frontend/src/hooks/
  useScreenshotDrop.ts          — handles both image and HTML drops/uploads
  useScreenshotDrop.test.ts

frontend/src/store/
  pinsStore.ts                  — addParsedPin(pin: PropertyPin) action

frontend/src/components/PropertyPins/
  AddPinButton.tsx              — 3-option menu (Place on map / Upload photo / Import HTML)
  AddPinButton.test.tsx
  ScreenshotDropZone.tsx        — contextual drag overlay + processing spinner
  PinCompareTable.tsx           — Rooms / Floor / Year columns; wider Comment column

frontend/src/test/
  setup.ts                      — Blob.prototype.text polyfill for jsdom
```

---

## Definition of Done

- [x] `IdealistaProperty` type defined
- [x] `PropertyPin` extended with new fields (backwards-compatible — all optional)
- [x] Parser extracts all fields from the sample file in `data/`
- [x] Geocoding resolves address to coordinates; falls back to neighborhood; shows approx banner
- [x] Drag & drop `.html` file onto map creates a pin
- [x] `+` menu → Import Idealista HTML creates a pin via file picker
- [x] Compare table shows Rooms / Floor / Year columns
- [x] Comment column is wide enough to display multi-line rich text
- [x] `comment` is auto-populated with address + orientation + amenities + description + energy
- [x] Unit tests cover parser, hook (image + HTML paths), and AddPinButton interactions
- [x] `npm test` green
- [x] `npm run lint` clean
- [x] `npm run typecheck` clean

---

## Notes

- Image URLs contain `blur/` — this is the real CDN path, images load correctly as-is.
- All new `PropertyPin` fields are optional so existing pins stored in localStorage are unaffected.
- The parser is stateless: HTML string in → plain object out. Side effects (geocoding, store writes) happen in `useScreenshotDrop`, not inside the parser.
- `AddPinButton` and `ScreenshotDropZone` each create their own `useScreenshotDrop` instance — they have separate `isProcessing` states so the button and the drop overlay don't interfere.
- Mantine `Menu` requires `withinPortal={false}` in tests (jsdom has no floating-ui layout). `Menu.Target` must not nest a `Tooltip` — use `title` attr instead.
- `Blob.prototype.text` is not implemented in jsdom; polyfilled via `FileReader` in `src/test/setup.ts`.
