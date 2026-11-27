import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS } from '../../store'
import { DEFAULT_CONDITIONS } from '../../services/buildings/conditions'
import type { BuildingData } from '../../services/buildings/buildingData'
import type { BuildingDetailResult } from '../../services/buildings/buildingDetail'

/** Building 0: Eixample block in el Raval's barri, water at the door. Building 1: student residence outside BCN (SICA). */
const DATA: BuildingData = {
  meta: {
    count: 2, columns: [], price_bounds: { p5: 2000, p95: 6000 },
    areas: [{ code: '01', name: 'el Raval', kind: 'barri', price: 4200 }, { code: '08015', name: 'Badalona', kind: 'muni', price: 2500 }],
    categories: ['supermarket', 'park'], landmarks: ['sagrada'],
  },
  count: 2,
  cols: {
    lng: Float32Array.from([2.16, 2.24]), lat: Float32Array.from([41.39, 41.45]),
    min_supermarket: Float32Array.from([3, 12]), min_park: Float32Array.from([NaN, 8]),
    cc_sagrada: Float32Array.from([12, 45]), lden_avg: Float32Array.from([64, 60]),
    area: Float32Array.from([0, 1]), river_zone: Float32Array.from([500, NaN]),
    fire_wui: Float32Array.from([0, 0]), fire_hazard: Float32Array.from([0, 0]),
    street_t10_cm: Float32Array.from([12, NaN]), street_t100_cm: Float32Array.from([35, NaN]),
    year_built: Float32Array.from([1890, 1900]),
  },
}

const DETAILS: BuildingDetailResult[] = [
  {
    detail: {
      i: 0, id: '0123456DF2802C', address: 'CL ARAGO 255; RB CATALUNYA 30', use: '1_residential',
      dwellings: 24, units: 30, floors: 7, floors_below: 1, year_built: 1890, year_renov: 1995, area_m2: 3200,
      noise_src: 'bcn_raster_2022', lden_avg: 64.2, ln_avg: 56, lden_street: 71.4, ln_street: 63,
      lden_inner: 52, ln_inner: 44, lden_max: 72, lden_min: 50,
      river_zone: 500, street_t10_cm: 12, street_t100_cm: 35, min_supermarket: 3,
    },
    facades: [
      { lng: 2.16, lat: 41.39, side: 'inner', dir: 'NE', length_m: 18, lden: 52, ln: 44 },
      { lng: 2.16, lat: 41.39, side: 'street', dir: 'SW', length_m: 21, lden: 72, ln: 63 },
    ],
  },
  {
    detail: {
      i: 1, id: '9999999DF3899A', use: '4_3_publicServices', student: 1, noise_src: 'sica_2022', lden_avg: 60,
      year_built: 1900,
    },
    facades: [],
  },
]

vi.mock('../../services/buildings/buildingData', async (orig) => ({
  ...(await orig<typeof import('../../services/buildings/buildingData')>()),
  get buildingData() { return DATA },
}))
vi.mock('../../services/buildings/buildingDetail', () => ({
  loadBuildingDetail: vi.fn((i: number) => Promise.resolve(DETAILS[i])),
}))
vi.mock('../../services/buildings/catastroUnits', async (orig) => ({
  ...(await orig<typeof import('../../services/buildings/catastroUnits')>()),
  loadCatastroUnits: vi.fn(() => Promise.resolve([
    { floor: '-1', use: 'Almacen-Estacionamiento' }, { floor: '00', use: 'Residencial' },
  ])),
}))
vi.mock('../../services/localsOpinion/localsOpinion', async (orig) => {
  const problems = {
    insecurity: 43.7, cleanliness: 10.4, noise: 8.4, housing: 3.1, tourism: 2.8,
    incivility: 5.4, drugs_squats: 8.3, maintenance: 1.5, parking: 0.3, traffic: 0.1,
  }
  return {
    ...(await orig<typeof import('../../services/localsOpinion/localsOpinion')>()),
    barriVibeData: {
      years: '2022–2026',
      city: { satisf: 7.85, stay: 54.7, problems },
      barris: { '01': { name: 'el Raval', n: 770, lowN: false, satisf: 6.55, satisfAdj: 6.55, stay: 35.6, delta: -0.6, problems } },
    },
  }
})

// The two test buildings are too few for a barri to be ranked in: lower the minimum to one.
vi.mock('../../services/buildings/buildingRank', async (orig) => {
  const m = await orig<typeof import('../../services/buildings/buildingRank')>()
  return { ...m, buildingRanks: (h: never, a: never, i: never, s: never) => m.buildingRanks(h, a, i, s, 1) }
})

vi.mock('../../services/shareImage/shareImageBrowser', () => ({
  renderShareBlob: vi.fn(() => Promise.resolve(new Blob(['x'], { type: 'image/png' }))),
  deliverImage: vi.fn(() => Promise.resolve('saved')),
}))

import { BuildingCard } from './BuildingCard'
import { useMapStore } from '../../store/mapStore'
import { deliverImage, renderShareBlob } from '../../services/shareImage/shareImageBrowser'

async function renderCard(i: number | null) {
  useStore.setState({ selectedBuilding: i })
  const view = render(<MantineProvider><BuildingCard /></MantineProvider>)
  await act(async () => {})
  return view
}

/** Opens every collapsed section of the details, and the facade list under Noise (TODO-072). */
function openAll() {
  // Two passes: the facade toggle only exists once Noise is open.
  for (const selector of ['button[aria-expanded="false"].section-row', '.sub-toggle[aria-expanded="false"]']) {
    for (const b of document.querySelectorAll<HTMLElement>(selector)) fireEvent.click(b)
  }
}

describe('BuildingCard (TODO-046)', () => {
  beforeEach(() => {
    useStore.setState({
      compositeWeights: DEFAULT_COMPOSITE_WEIGHTS, enabledWalkCategories: ['supermarket', 'park'],
      enabledLandmarkIds: ['sagrada'], compositeRiskStrengths: { flood: 5, fire: 5, street: 5 },
      ageEras: ['before-1900', '1900-1939', '1940-1979', '1980-2006', '2007-on'],
      conditions: DEFAULT_CONDITIONS, buildingScores: null,
    })
  })

  it('shows the score range and "Incomplete data" when a condition has no data (060)', async () => {
    // Locals' opinion on, but building 1 is outside Barcelona's barris → no data for it
    useStore.setState({ compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, localsOpinion: 1 } })
    await renderCard(1)
    expect(screen.getByTestId('match-band').textContent).toMatch(/^Possibly a (great|good|partial|poor) match$/)
    const ring = screen.getByTestId('match-ring').textContent!
    expect(ring).toMatch(/^\d+–\d+$/)
    expect(screen.getByTestId('match-ring')).toHaveAttribute('data-incomplete', 'true')
    const [lo, hi] = ring.split('–').map(Number)
    expect(lo).toBeLessThan(hi)
    expect(screen.getByTestId('incomplete-note').textContent).toMatch(/^Incomplete data/)
  })

  it('a building without gaps shows one number and no note (060)', async () => {
    await renderCard(0)
    expect(screen.queryByTestId('incomplete-note')).not.toBeInTheDocument()
  })

  it('renders nothing without a selected building', async () => {
    await renderCard(null)
    expect(screen.queryByText('Livability')).not.toBeInTheDocument()
  })

  it('opens with the match summary: band and score, no "Meets N of M" count; no per-condition rows under it (TODO-072)', async () => {
    await renderCard(0)
    const header = screen.getByTestId('match-header')
    // the ring comes first, then the label and the band
    const block = screen.getByTestId('match-block')
    expect(header.firstElementChild).toBe(block)
    expect(block.firstElementChild).toBe(screen.getByTestId('match-ring'))
    expect(screen.getByTestId('match-ring').textContent).toMatch(/^\d+$/)
    expect(screen.getByTestId('match-label').textContent).toBe('Match with your conditions')
    expect(screen.getByTestId('match-band').textContent).toMatch(/^(Great|Good|Partial|Poor) match$/)
    // the count read "meets 1 of 3" under a 92 and argued with the band: gone (2026-11-16)
    expect(screen.queryByText(/Meets/)).not.toBeInTheDocument()
    // the rows duplicated the sections below: gone
    expect(screen.queryByTestId('condition-noise')).not.toBeInTheDocument()
    expect(screen.queryByTestId('risk-line')).not.toBeInTheDocument()
    expect(document.querySelector('.condition-lines')).toBeNull()
  })

  it('the sections come right after the header, all folded, and the building details are the last one (TODO-072)', async () => {
    await renderCard(0)
    expect(screen.queryByTestId('details-toggle')).not.toBeInTheDocument()
    const rows = [...document.querySelectorAll<HTMLElement>('button.section-row')]
    expect(rows.length).toBeGreaterThan(3)
    for (const r of rows) expect(r).toHaveAttribute('aria-expanded', 'false')
    expect(document.querySelector('.building-strip')).toBeNull()
    const last = rows.at(-1)!
    expect(last).toHaveTextContent('Details about this building')
    fireEvent.click(last)
    const strip = document.querySelector('.building-strip')!
    expect(strip).not.toBeNull()
    expect(screen.getByText(/Open in Catastro/)).toBeInTheDocument()
    expect(last.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a condition without data shows no risk line and no count (TODO-050)', async () => {
    useStore.setState({
      compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, localsOpinion: 1 }, compositeRiskStrengths: { flood: 0, fire: 0, street: 0 },
    })
    await renderCard(1)
    expect(screen.queryByText(/Meets/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Risk: −/)).not.toBeInTheDocument()
  })

  it('shows the address, Catastro facts, photo and link', async () => {
    await renderCard(0)
    openAll()
    // The first address is the title; the others open on a click.
    expect(screen.getByText('Carrer Arago 255')).toBeInTheDocument()
    expect(screen.queryByText('Rambla Catalunya 30')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('address-more'))
    expect(screen.getByText('Rambla Catalunya 30')).toBeInTheDocument()
    expect(screen.getByTestId('address-list')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Show fewer'))
    expect(screen.queryByText('Rambla Catalunya 30')).not.toBeInTheDocument()
    expect(screen.getByText('Residential')).toBeInTheDocument()
    // the strip: a number over a label
    const strip = document.querySelector<HTMLElement>('.facts-strip')!
    const fact = (label: string) => within(strip).getByText(label).previousElementSibling!.textContent
    expect(fact('dwellings')).toBe('24')
    expect(fact('floors')).toBe('7')
    expect(fact('Historic')).toBe('1890')
    expect(fact('built area')).toBe('3,200 m²')
    expect(fact('below ground')).toBe('+1')
    expect(fact('renovated')).toBe('1995')
    expect(fact('other premises')).toBe('6')
    expect(await screen.findByText('Below ground: parking / storage')).toBeInTheDocument() // from Catastro units
    expect(screen.getByRole('img', { name: /Carrer Arago/ }).getAttribute('src')).toContain('ReferenciaCatastral=0123456DF2802C')
    expect(screen.getByText('Photo © Dirección General del Catastro')).toBeInTheDocument()
    expect(screen.getByText(/Open in Catastro/).getAttribute('href')).toContain('rc1=0123456&rc2=DF2802C')
  })

  it('shows facade noise by side and direction, walking minutes', async () => {
    await renderCard(0)
    openAll()
    expect(screen.getByText('Street side: 71 dB · night 63')).toBeInTheDocument()
    expect(screen.getByText('Courtyard side: 52 dB · night 44')).toBeInTheDocument()
    expect(screen.getByText(/Street · faces SW · 21 m — 72 dB/)).toBeInTheDocument()
    expect(screen.getByText('3 min')).toBeInTheDocument()
    expect(screen.getByText('none nearby')).toBeInTheDocument() // park: out of walking reach
  })

  it('leads the noise block with the street side and names the quiet courtyard (TODO-073)', async () => {
    await renderCard(0)
    openAll()
    expect(screen.getByText(/^Street side: 71 dB — what your condition is checked against/)).toBeInTheDocument()
    expect(screen.getByTestId('quiet-side').textContent).toBe('Quiet side: courtyard, 52 dB — within your limit')
  })

  it('a building without a street side is checked on all its facades, with no quiet-side line (TODO-073)', async () => {
    await renderCard(1)
    openAll()
    expect(screen.getByText(/^All facades: ≈ 60 dB \(no street side\)/)).toBeInTheDocument()
    expect(screen.queryByTestId('quiet-side')).not.toBeInTheDocument()
  })

  it('says when the budget ceiling lowered the score (TODO-073)', async () => {
    // Quiet (64 dB within 65) and of a liked era (1890), but €4,000/m² against a budget of €1,500: mean 67 → 64.
    useStore.setState({
      compositeWeights: { poiAccess: 0, noise: 1, cityCore: 0, openPrice: 1, localsOpinion: 0, age: 1 },
      conditions: { ...DEFAULT_CONDITIONS, priceMaxEurM2: 1500 },
      compositeRiskStrengths: { flood: 0, fire: 0, street: 0 },
      ageEras: ['before-1900'],
    })
    await renderCard(0)
    expect(screen.getByTestId('over-budget').textContent).toBe('Over your budget: at most a partial match')
    expect(Number(screen.getByTestId('match-ring').textContent)).toBeLessThanOrEqual(64)
    // Many homes of an expensive barri share the ceiling: no "among the best" for a home over the budget.
    expect(screen.queryByTestId('rank-lines')).not.toBeInTheDocument()
  })

  it('no budget line within the budget (TODO-073)', async () => {
    await renderCard(0)
    expect(screen.queryByTestId('over-budget')).not.toBeInTheDocument()
  })

  it('says how the building meets each condition that is on (049)', async () => {
    useStore.setState({ compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, localsOpinion: 1 } })
    await renderCard(0)
    openAll()
    expect(screen.getByText('1 of 2 services within 10 min')).toBeInTheDocument()
    expect(screen.getByText('64 dB — within your 65 dB')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 place within 30 min')).toBeInTheDocument()
    expect(screen.getByText(/^Sale price: €4[.,]?200\/m² — 5% over your €4[.,]?000\/m²$/)).toBeInTheDocument()
    expect(screen.getByText(/^Residents rate 6\.[56] — below your 7\.5$/)).toBeInTheDocument()
  })

  it('warns about ground floors and explains the water at the door', async () => {
    await renderCard(0)
    openAll()
    expect(screen.getByText(/Careful if you are looking at a ground-floor flat.*1 floor below ground/)).toBeInTheDocument()
    expect(screen.getByText(/12 cm in a 10-year rain, 35 cm in a 100-year rain/)).toBeInTheDocument()
    expect(screen.getByText(/500-year river flood zone/)).toBeInTheDocument()
  })

  it('labels price and Locals’ opinion as barri-level', async () => {
    await renderCard(0)
    openAll()
    expect(screen.getByText('The same for every building in the barri')).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/€4[.,]?200\/m²/)
    expect(screen.getByText('What locals say')).toBeInTheDocument()
  })

  it('student residence outside Barcelona: SICA note, municipality level', async () => {
    await renderCard(1)
    openAll()
    expect(screen.getByText('Student residence')).toBeInTheDocument()
    expect(screen.getByText(/Different official model \(SICA 2022/)).toBeInTheDocument()
    expect(screen.getByText('The same for every building in the municipality')).toBeInTheDocument()
    expect(screen.getByText('Not available outside Barcelona city')).toBeInTheDocument()
  })

  it('building age (TODO-047): a section only when the weight is on; the renovation is shown, not scored', async () => {
    await renderCard(0)
    expect(screen.queryByText('Building age')).not.toBeInTheDocument()
    cleanup()
    useStore.setState({ compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, age: 1 }, ageEras: ['2007-on'] })
    await renderCard(0)
    expect(screen.getAllByText('Building age')).toHaveLength(1)
    expect(screen.getByText('Historic, before 1900 — not one of your eras')).toBeInTheDocument()
    expect(screen.getByText('Renovated 1995 — shown only; the score uses the year built')).toBeInTheDocument()
  })

  it("Catastro's 1900: era shown with a note, counted for both neighbouring eras", async () => {
    useStore.setState({ compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, age: 1 }, ageEras: ['before-1900'] })
    await renderCard(1)
    openAll()
    const strip = document.querySelector<HTMLElement>('.facts-strip')!
    expect(within(strip).getByText('Modernista & early 20th c.').previousElementSibling!.textContent).toBe('1900')
    expect(screen.getByText("Catastro's date for many old buildings — the exact year is unknown")).toBeInTheDocument()
    expect(screen.getByText('Modernista & early 20th c., 1900–1939 — counts as one of your eras')).toBeInTheDocument()
  })

  describe('Details sections (TODO-072)', () => {
    const row = (title: string) => screen.getByText(title, { selector: 'b' }).closest('.section-row') as HTMLElement

    it('every section is closed at first', async () => {
      await renderCard(0)
      for (const title of ['Noise', 'Climate risk', 'Services on foot', 'City Core Access']) {
        expect(row(title)).toHaveAttribute('aria-expanded', 'false')
      }
      expect(screen.queryByText('none nearby')).not.toBeInTheDocument()
      expect(screen.queryByText(/Street side: 71 dB/)).not.toBeInTheDocument()
    })

    it('a tap opens and closes one section, the others keep their state', async () => {
      await renderCard(0)
      fireEvent.click(row('Noise'))
      fireEvent.click(row('Services on foot'))
      expect(screen.getByText('none nearby')).toBeInTheDocument()
      expect(row('Noise')).toHaveAttribute('aria-expanded', 'true')
      fireEvent.click(row('Services on foot'))
      expect(screen.queryByText('none nearby')).not.toBeInTheDocument()
      fireEvent.click(row('Noise'))
      expect(screen.queryByText(/Street side: 71 dB/)).not.toBeInTheDocument()
    })

    it('shows the verdict of every section on its closed row, with the ring score', async () => {
      await renderCard(0)
      const walk = row('Services on foot')
      expect(walk).toHaveTextContent('1 of 2 services within 10 min')
      expect(walk.querySelector('.section-ring')).toHaveTextContent(/^\d+$/)
      expect(row('Noise')).toHaveTextContent('64 dB — within your 65 dB')
    })

    it('Climate risk leads with the points lost, and the verdict names the risks', async () => {
      await renderCard(0)
      const lead = screen.getByTestId('risk-lead').textContent!
      expect(lead).toMatch(/^−\d+$/)
      expect(row('Climate risk')).toHaveTextContent(new RegExp(`^${lead}Climate risk.*River flooding`))
    })

    it('the facade list is behind its own toggle, closed at first', async () => {
      await renderCard(0)
      fireEvent.click(row('Noise'))
      expect(screen.queryByText(/Street · faces SW/)).not.toBeInTheDocument()
      const toggle = screen.getByRole('button', { name: /Facade by facade/ })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(toggle)
      expect(screen.getByText(/Street · faces SW · 21 m — 72 dB/)).toBeInTheDocument()
    })

    it('Building age is a plain row without a body, the renovation under it', async () => {
      useStore.setState({ compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, age: 1 }, ageEras: ['2007-on'] })
      await renderCard(0)
      const age = screen.getByText('Building age', { selector: 'b' }).closest('.section-row') as HTMLElement
      expect(age.tagName).toBe('DIV')
      expect(age).not.toHaveAttribute('aria-expanded')
      expect(screen.getByText('Renovated 1995 — shown only; the score uses the year built')).toBeInTheDocument()
    })

    it('has no service emoji and no per-service bars', async () => {
      await renderCard(0)
      openAll()
      expect(document.body.textContent).not.toMatch(/🛒|🌳/u)
    })
  })

  describe('Details and ranks (TODO-070)', () => {
    it('shows where the building stands out, in the barri and in Barcelona, for the conditions', async () => {
      useStore.setState({ buildingScores: Uint8Array.from([50, 90]) })
      await renderCard(0)
      const lines = screen.getByTestId('rank-lines')
      expect(lines).toHaveAttribute('data-count', '2')
      expect(screen.getByTestId('rank-local')).toHaveTextContent(/^Top (10|20)%of homes in el Raval$/)
      expect(screen.getByTestId('rank-wide')).toHaveTextContent(/^Top (10|20)%of homes in Barcelona$/)
      expect(screen.queryByTestId('rank-scale')).not.toBeInTheDocument()
    })

    it('outside Barcelona: the municipality and the metro area', async () => {
      useStore.setState({ buildingScores: Uint8Array.from([50, 0]) })
      await renderCard(1)
      expect(screen.getByTestId('rank-local')).toHaveTextContent(/ in Badalona/)
      expect(screen.getByTestId('rank-wide')).toHaveTextContent(/ in the Barcelona area/)
    })

    it('shows the lines while the sections are folded', async () => {
      useStore.setState({ buildingScores: Uint8Array.from([50, 90]) })
      await renderCard(0)
      expect(screen.getByTestId('rank-lines')).toBeInTheDocument()
    })

    it('has no block at all when the building stands out nowhere', async () => {
      // every other building scores 100: this one beats none of them
      useStore.setState({ buildingScores: Uint8Array.from([100, 100]) })
      await renderCard(0)
      expect(screen.queryByTestId('rank-lines')).not.toBeInTheDocument()
      expect(screen.queryByText('For your conditions')).not.toBeInTheDocument()
    })

    it('has no rank lines before the scores are in', async () => {
      await renderCard(0)
      expect(screen.queryByTestId('rank-lines')).not.toBeInTheDocument()
    })

    it('has no rank lines, and says why, when the building has incomplete data', async () => {
      useStore.setState({ buildingScores: Uint8Array.from([50, 90]), compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, localsOpinion: 1 } })
      await renderCard(1)
      expect(screen.queryByTestId('rank-lines')).not.toBeInTheDocument()
      expect(screen.getByTestId('rank-incomplete')).toHaveTextContent(/^No rank/)
    })

    it('puts the rank lines on the picture, with the heading when no profile says for whom', async () => {
      useMapStore.setState({ map: { id: 'map' } as never })
      useStore.setState({ buildingScores: Uint8Array.from([50, 90]) })
      await renderCard(0)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save image/ })) })
      const model = vi.mocked(renderShareBlob).mock.calls.at(-1)![2]
      expect(model.ranks).toHaveLength(2)
      expect(model.ranks[0].text).toMatch(/in el Raval/)
      expect(model.ranks[0].value).toMatch(/^Top (10|20)%$/)
      expect(model.ranksHeading).toBe('For your conditions')
    })
  })

  it('a building with one address has no "more" button', async () => {
    await renderCard(1)
    expect(screen.queryByTestId('address-more')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    await renderCard(0)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useStore.getState().selectedBuilding).toBeNull()
  })

  describe('Save image (TODO-063)', () => {
    beforeEach(() => {
      vi.mocked(renderShareBlob).mockClear()
      vi.mocked(deliverImage).mockClear()
      useMapStore.setState({ map: { id: 'map' } as never })
    })

    it('makes the picture of the building: first address with its number, the score, the rows', async () => {
      await renderCard(0)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save image/ })) })
      expect(renderShareBlob).toHaveBeenCalledTimes(1)
      const [, lngLat, model] = vi.mocked(renderShareBlob).mock.calls[0]
      expect(lngLat).toEqual([expect.closeTo(2.16, 3), expect.closeTo(41.39, 3)])
      expect(model.place).toBe('Carrer Arago 255')
      expect(model.subtitle).toBe('el Raval, Barcelona')
      expect(model.value).toMatch(/^\d+$/)
      expect(model.rows.length).toBeGreaterThan(0)
      expect(JSON.stringify(model)).not.toMatch(/Meets/)
      expect(deliverImage).toHaveBeenCalledWith(expect.any(Blob), 'Carrer Arago 255', expect.stringContaining('http'))
      expect(await screen.findByText('Image saved.')).toBeInTheDocument()
    })

    it('says "For a family" only when the settings are that profile', async () => {
      await renderCard(0)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save image/ })) })
      expect(vi.mocked(renderShareBlob).mock.calls[0][2].forWhom).toBeNull()
    })

    it('says so when the picture cannot be made', async () => {
      vi.mocked(renderShareBlob).mockRejectedValueOnce(new Error('no canvas'))
      vi.spyOn(console, 'error').mockImplementation(() => {})
      await renderCard(0)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save image/ })) })
      expect(await screen.findByText('Could not make the image. Try again.')).toBeInTheDocument()
    })

    it('does nothing without a map', async () => {
      useMapStore.setState({ map: null })
      await renderCard(0)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save image/ })) })
      expect(renderShareBlob).not.toHaveBeenCalled()
    })
  })
  describe('Share (TODO-064)', () => {
    it('copies a link that opens this building with the conditions', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      await renderCard(0)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Share' })) })
      expect(writeText).toHaveBeenCalledTimes(1)
      const url = new URL(writeText.mock.calls[0][0])
      expect(url.searchParams.get('b')).toMatch(/^2\.16\d*,41\.39\d*$/)
      expect(url.searchParams.get('zoom')).toBe('17.00')
      expect(url.searchParams.has('c')).toBe(true)
      expect(await screen.findByText(/opens this building/)).toBeInTheDocument()
    })
  })
})
