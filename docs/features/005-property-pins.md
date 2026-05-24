# 005 · Property pins

## Goal

Allow the user to place pins on the map representing candidate apartments. Each pin automatically computes travel times from the pin location to the configured workplace and shows them in a sortable left-panel list.

## Status

Implemented.

## Scope

### Data model

```typescript
interface PropertyPin {
  id: string                    // uuid
  coordinates: [number, number] // [lng, lat]
  price?: number                // EUR
  area?: number                 // m² (user-provided)
  url?: string                  // Idealista listing URL
  photos?: string[]             // base64-encoded images (max 5, compressed to ≤200KB each)
  comment?: string
  analytics?: PinAnalytics
  createdAt: string             // ISO-8601
}

interface PinAnalytics {
  walkingMinutes?: number
  publicTransportMinutes?: number
  cyclingMinutes?: number
  drivingMinutes?: number
  travelIndex?: number          // composite score (see Sorting)
  calculatedAt: string          // ISO-8601; recalculate when workplace changes
}
```

`pricePerSqm` is derived at render time: `price / area` — not stored.

### Adding a pin

1. User clicks the **"Add pin"** floating button (bottom-right of map).
2. The cursor changes to a crosshair; next click on the map drops a pin at those coordinates.
3. The pin edit drawer opens immediately (see Edit drawer).
4. Analytics are triggered automatically (see Analytics).

The pin is saved to localStorage as soon as it is created (before the drawer is closed), so closing the drawer without filling any fields does not lose the point.

### Moving a pin

- The pin marker on the map is **draggable**.
- On drag-end, coordinates are updated in the store and analytics are recalculated.
- No edit drawer opens on drag — coordinates update silently.

### Deleting a pin

- A **Delete** button is available in the edit drawer and on the list card.
- No confirmation dialog — delete is immediate.

### Edit drawer

Slides in from the right when a pin is selected (marker click or list card click).

Fields:

| Field | Input | Notes |
|---|---|---|
| Price | Number input | EUR |
| Area | Number input | m² |
| Price / m² | Read-only | Derived, shown as `€X,XXX /m²` |
| URL | Text input | Idealista listing link |
| Photos | File upload | Max 5 images; stored as base64 |
| Comment | Textarea | Free text |

Close button in the drawer header. Save on field blur (auto-save).

### Analytics: routing to workplace

Triggered automatically when:
- A pin is created (if workplace is set)
- A pin is moved
- The workplace changes (recalculate all pins)

If workplace is `null` — analytics are skipped; show "Set workplace to calculate travel times" placeholder.

**Routing calls (per pin):**

| Mode | Service | Endpoint |
|---|---|---|
| Walking | ORS | `POST /v2/directions/foot-walking` |
| Cycling | ORS | `POST /v2/directions/cycling-regular` |
| Driving | ORS | `POST /v2/directions/driving-car` |
| Public transport | OTP2 | `GET /otp/routers/default/plan` (or GraphQL) |

New function in `services/ors.ts`:
```typescript
fetchRouteDuration(
  from: [number, number],
  to: [number, number],
  mode: OrsMode,
): Promise<number>  // seconds
```
Body: `{"coordinates": [[lng1,lat1], [lng2,lat2]]}`. Extracts `routes[0].summary.duration`.

New function in `services/otp.ts`:
```typescript
fetchOtpRouteDuration(
  from: [number, number],
  to: [number, number],
): Promise<number>  // seconds
```
Uses OTP2 plan endpoint; `time` defaults to next Monday 09:00 Europe/Madrid (same convention as isochrone). Extracts `plan.itineraries[0].duration`.

OTP2 errors (e.g. server not running) are non-fatal: `publicTransportMinutes` stays `undefined`, others still compute.

All 4 calls are fired in parallel (`Promise.allSettled`).

### Sorting and travel index

**`travelIndex`** — normalized score 0–100 (higher = better).

Each mode is normalized against a reference cap of **60 minutes** (anything ≥ 60 min contributes 0):

```
norm(min) = max(0, 1 - min / 60) ^ 0.7

travelIndex = round(
  (norm(walkMin)*4 + norm(ptMin)*3 + norm(cycleMin)*2 + norm(carMin)*1)
  / (sumOfPresentWeights)
  * 100
)
```

The `^0.7` exponent is a concave curve that better rewards short commutes without over-compressing mid-range values (e.g. 10 min → 87 vs 83 with linear).

`sumOfPresentWeights` is the sum of weights only for modes that have a value (handles OTP2 being unavailable). If no mode has data → `travelIndex` is `undefined`.

Examples (updated for ^0.7 curve):
- walk=10, pt=15, bike=12, car=8 → index ≈ **87**
- walk=35, pt=40, bike=30, car=20 → index ≈ **50**
- walk=60, pt=60, bike=60, car=60 → index = **0**

Weights reflect user priority: walking (4) > public transport (3) > cycling (2) > driving (1). Hardcoded for 005; configurable in [007-analytics-weights](TODO-007-analytics-weights.md).

Default list sort: **descending by `travelIndex`** (highest score = best = top of list). Pins with `undefined` index appear at the bottom.

### Left panel: pin list

Persistent sidebar on the left (same column as FilterPanel). A scrollable list of `PropertyPinCard` components.

Each card shows:
- First photo thumbnail (or a placeholder icon if no photos)
- Price (formatted as `€XXX,XXX`) and area (`XX m²`) on one line
- Price/m² on second line (if both price and area are set)
- Travel times row: 🚶 Xmin · 🚌 Xmin · 🚲 Xmin · 🚗 Xmin (show `—` if unavailable)
- Travel index badge
- Delete button (trash icon, top-right corner of card)

Click on card → opens edit drawer for that pin.

### Map markers

Each pin renders as a numbered circle marker (number = rank in sorted list). Color encodes the index value:
- Green: index ≥ 70
- Yellow: 40–69
- Red: < 40 (or no data)

Clicking a marker → opens edit drawer.

### Persistence

Store the `propertyPins` array in `localStorage` under key `bcn_property_pins`. Serialize/deserialize on app load. No sync across tabs needed for MVP.

Photos are base64-encoded and included in the stored JSON. **Practical limit: ~5–10 photos total** before localStorage quota is a concern; no hard cap in code for now.

### Store additions

Extend `AppState` in `store/index.ts`:

```typescript
propertyPins: PropertyPin[]
selectedPinId: string | null
addPin: (lngLat: [number, number]) => void          // creates pin, triggers analytics
updatePin: (id: string, patch: Partial<PropertyPin>) => void
deletePin: (id: string) => void
setSelectedPin: (id: string | null) => void
```

A `useEffect` in the app recalculates analytics for all pins when `workplace` changes.

## Out of scope (005)

- Screenshot parsing → [006-screenshot-parsing](TODO-006-screenshot-parsing.md)
- Configurable analytics weights → [007-analytics-weights](TODO-007-analytics-weights.md)
- Isochrone membership check (pin inside/outside zone)
- Address field / geocoding
- JSON export / import
- Status tags (interested / rejected / visited)

## Done when

1. User can click map to place a pin and drag it to reposition.
2. Edit drawer opens with all fields; auto-saves on blur.
3. Delete works from both drawer and list card.
4. ORS and OTP2 route durations are fetched and stored per pin; recalculated on workplace change.
5. `travelIndex` is computed correctly with the 4:3:2:1 weights.
6. Left panel shows sorted list; cards display all analytics.
7. Map markers are numbered and color-coded.
8. Pins persist across page reloads via localStorage.
9. Unit tests cover: `fetchRouteDuration`, `fetchOtpRouteDuration`, `travelIndex` computation, localStorage serialize/deserialize.
10. `npm test`, `npm run lint`, `npm run typecheck` — all pass.
11. Manually verified on dev server.
