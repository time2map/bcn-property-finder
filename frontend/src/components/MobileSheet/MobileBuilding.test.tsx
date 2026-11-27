import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS } from '../../store'
import { useSheetStore } from '../../store/sheetStore'
import { DEFAULT_CONDITIONS } from '../../services/buildings/conditions'
import type { BuildingData } from '../../services/buildings/buildingData'
import type { BuildingDetailResult } from '../../services/buildings/buildingDetail'
import { useSheetFlow } from '../../hooks/useSheetFlow'
import { sheetHeights } from '../../services/sheetSnap'

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


import { BuildingCard } from '../BuildingCard/BuildingCard'
import { MobileSheet } from './MobileSheet'
import { ConditionsSheetHeader } from './ConditionsSheetHeader'

/** The phone layout of the sheet and the card, as App puts them together. */
function Phone() {
  useSheetFlow(true)
  const open = useStore((s) => s.selectedBuilding !== null)
  return (
    <MantineProvider>
      <MobileSheet view={open ? 'building' : 'main'} header={<ConditionsSheetHeader />} main={<p>Conditions editor</p>}>
        <BuildingCard embedded />
      </MobileSheet>
    </MantineProvider>
  )
}

const sheet = () => screen.getByRole('region', { name: 'Conditions and details' })
const H = sheetHeights(window.innerHeight)

function pointer(el: Element, type: 'down' | 'move' | 'up', y: number, t: number) {
  const ev = new PointerEvent(`pointer${type}`, { clientY: y, pointerId: 1, bubbles: true })
  Object.defineProperty(ev, 'timeStamp', { value: t })
  act(() => { el.dispatchEvent(ev) })
}

/** A finger tap on a button: press, release, click. */
function tap(el: Element) {
  pointer(el, 'down', 300, 0)
  pointer(el, 'up', 300, 50)
  fireEvent.click(el)
}

describe('Phone: a building in the sheet (TODO-062)', () => {
  beforeEach(() => {
    useStore.setState({
      selectedBuilding: null, compositeWeights: DEFAULT_COMPOSITE_WEIGHTS, enabledWalkCategories: ['supermarket', 'park'],
      enabledLandmarkIds: ['sagrada'], compositeRiskStrengths: { flood: 5, fire: 5, street: 5 },
      ageEras: ['before-1900'], conditions: DEFAULT_CONDITIONS,
    })
    useSheetStore.setState({ position: 'half', mapInset: 0, tab: 'settings', pickedArea: null, restore: null })
  })

  it('tap a building → peek with the address and the match → drag to full → close → back to where it was', async () => {
    render(<Phone />)
    expect(sheet()).toHaveAttribute('data-view', 'main')

    // Tap a building on the map.
    await act(async () => { useStore.getState().setSelectedBuilding(0) })
    expect(sheet()).toHaveAttribute('data-view', 'building')
    expect(sheet()).toHaveAttribute('data-position', 'peek')
    expect(await screen.findByText(/^Carrer Arago 255/)).toBeVisible()
    expect(screen.getByTestId('peek-match').textContent).toMatch(/^(Great|Good|Partial|Poor) match$/)

    // The peek has the small ring, and the band; the body opens with the large ring.
    expect(screen.getByTestId('match-ring')).toBeInTheDocument()
    expect(screen.getByTestId('match-band')).toBeInTheDocument()

    // Drag the header up to full: the details are there to scroll.
    const address = screen.getByTestId('peek-match') // inside a portal: the drag must still reach the sheet
    pointer(address, 'down', 600, 0)
    pointer(address, 'move', 150, 300)
    pointer(address, 'up', 150, 320)
    expect(sheet()).toHaveAttribute('data-position', 'full')
    expect(sheet().style.transform).toBe(`translateY(${H.full - H.full}px)`)
    // The sections follow the header, folded (TODO-072).
    expect(screen.getByText('Services on foot')).toBeInTheDocument()

    // Close: the conditions come back, at the position they had.
    tap(screen.getByRole('button', { name: 'Close building card' }))
    expect(sheet()).toHaveAttribute('data-view', 'main')
    expect(sheet()).toHaveAttribute('data-position', 'half')
  })

  it('another building replaces the content and keeps the position', async () => {
    render(<Phone />)
    await act(async () => { useStore.getState().setSelectedBuilding(0) })
    fireEvent.click(screen.getByRole('button', { name: 'Open the panel' }))
    expect(sheet()).toHaveAttribute('data-position', 'half')
    await act(async () => { useStore.getState().setSelectedBuilding(1) })
    expect(sheet()).toHaveAttribute('data-position', 'half')
    await waitFor(() => expect(screen.queryByText(/^Carrer Arago 255/)).not.toBeInTheDocument())
    expect(screen.getByTestId('peek-match')).toBeInTheDocument()
  })
})
