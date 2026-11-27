// Small building data for the funnel tests (TODO-076). Not part of the app.
import type { BuildingData, BuildingsMeta } from '../buildings/buildingData'
import type { BarriVibeData } from '../localsOpinion/localsOpinion'

export const N = NaN

/** Buildings by column; `area` indexes AREAS. */
export function fixture(cols: Record<string, number[]>): BuildingData {
  const count = cols.area.length
  const meta = {
    count,
    columns: [],
    areas: [
      { code: '01', name: 'el Raval', kind: 'barri', price: 3000 },
      { code: '02', name: 'el Gòtic', kind: 'barri', price: 5000 },
      { code: '08015', name: 'Badalona', kind: 'muni', price: 2000 },
    ],
    price_bounds: { p5: 0, p95: 0 },
    categories: [],
    landmarks: [],
  } as unknown as BuildingsMeta
  return { meta, count, cols: Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, Float32Array.from(v)])) }
}

export const VIBE = { years: '', city: {}, barris: { '01': { satisfAdj: 6 }, '02': { satisfAdj: 8 } } } as unknown as BarriVibeData

export const base = {
  area: [0, 1, 2, 0, 1],
  dwellings: [10, 10, 10, 2, N],
  lden_street: [60, N, 50, 50, 50],
  lden_avg: [55, 52, 50, 50, 50],
  cc_placa_cat: [10, 20, 30, 5, 5],
  cc_barri_gotic: [15, 5, 30, 5, 5],
  cc_pg_gracia: [N, 30, 30, 5, 5],
  min_metro: [2, 3, 4, 1, 1],
  min_park: [5, N, 1, 1, 1],
  min_supermarket: [2, 3, 1, 1, 1],
  min_pharmacy: [4, N, 1, 1, 1],
  min_school: [1, 1, 1, 1, 1],
  min_kindergarten: [1, 1, 1, 1, 1],
  min_cafe: [1, 1, 1, 1, 1],
  min_restaurant: [1, 1, 1, 1, 1],
  min_clinic: [3, 6, 1, 1, 1],
  min_beach: [N, 12, N, N, N],
  year_built: [1900, 2010, 1990, 2000, 2000],
}

/** `n` Barcelona buildings with varied values (a fixed pseudo-random sequence), enough for five cutting steps. */
export function cityFixture(n = 400): BuildingData {
  let seed = 7
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  const int = (lo: number, hi: number) => () => lo + Math.floor(rnd() * (hi - lo + 1))
  const make = (f: () => number) => Array.from({ length: n }, f)
  return fixture({
    area: make(() => (rnd() < 0.5 ? 0 : 1)),
    dwellings: make(int(4, 60)),
    lden_street: make(int(45, 75)),
    lden_avg: make(int(45, 70)),
    cc_placa_cat: make(int(1, 60)),
    cc_barri_gotic: make(int(1, 60)),
    cc_pg_gracia: make(int(1, 60)),
    min_metro: make(int(1, 15)),
    min_park: make(int(1, 15)),
    min_supermarket: make(int(1, 15)),
    min_pharmacy: make(int(1, 15)),
    min_school: make(int(1, 15)),
    min_kindergarten: make(int(1, 15)),
    min_cafe: make(int(1, 15)),
    min_restaurant: make(int(1, 15)),
    min_clinic: make(int(1, 15)),
    min_beach: make(() => (rnd() < 0.3 ? 10 : NaN)),
    year_built: make(int(1850, 2024)),
    lng: make(() => 2.1 + rnd() * 0.1),
    lat: make(() => 41.35 + rnd() * 0.08),
  })
}
