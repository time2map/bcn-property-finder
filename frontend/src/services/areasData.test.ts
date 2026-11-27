import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import bbox from '@turf/bbox'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

// The shipped areas file (public/data/areas.geojson): ids and names are used by area links and aliases, so they
// must stay stable when the sources behind the outlines change.

type Area = Feature<Polygon | MultiPolygon, { id: string; name: string; kind: string; parent?: string }>

const fc = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/areas.geojson'), 'utf8')) as FeatureCollection
const areas = fc.features as Area[]
const byKind = (kind: string) => areas.filter((a) => a.properties.kind === kind)

// [display name, lng, lat of a point well inside the municipality (pole of inaccessibility)]
const MUNICIPALITIES: Record<string, [string, number, number]> = {
  'muni-badalona': ['Badalona', 2.2411, 41.4635],
  'muni-badia-del-vallès': ['Badia del Vallès', 2.1126, 41.5084],
  'muni-barberà-del-vallès': ['Barberà del Vallès', 2.1355, 41.5199],
  'muni-begues': ['Begues', 1.9040, 41.3193],
  'muni-castellbisbal': ['Castellbisbal', 1.9657, 41.4891],
  'muni-castelldefels': ['Castelldefels', 1.9758, 41.2791],
  'muni-cerdanyola-del-vallès': ['Cerdanyola del Vallès', 2.1341, 41.4778],
  'muni-cervelló': ['Cervelló', 1.9645, 41.3878],
  'muni-corbera-de-llobregat': ['Corbera de Llobregat', 1.9129, 41.4194],
  'muni-cornellà-de-llobregat': ['Cornellà de Llobregat', 2.0787, 41.3577],
  'muni-el-papiol': ['El Papiol', 2.0108, 41.4419],
  'muni-el-prat-de-llobregat': ['El Prat de Llobregat', 2.0935, 41.3093],
  'muni-esplugues-de-llobregat': ['Esplugues de Llobregat', 2.0908, 41.3781],
  'muni-gavà': ['Gavà', 2.0069, 41.2900],
  'muni-la-palma-de-cervelló': ['La Palma de Cervelló', 1.9500, 41.4109],
  'muni-lhospitalet-de-llobregat': ["L'Hospitalet de Llobregat", 2.1153, 41.3590],
  'muni-molins-de-rei': ['Molins de Rei', 2.0265, 41.4143],
  'muni-montcada-i-reixac': ['Montcada i Reixac', 2.1893, 41.4884],
  'muni-montgat': ['Montgat', 2.2905, 41.4751],
  'muni-pallejà': ['Pallejà', 1.9919, 41.4216],
  'muni-ripollet': ['Ripollet', 2.1565, 41.4980],
  'muni-sant-adrià-de-besòs': ['Sant Adrià de Besòs', 2.2232, 41.4218],
  'muni-sant-andreu-de-la-barca': ['Sant Andreu de la Barca', 1.9676, 41.4522],
  'muni-sant-boi-de-llobregat': ['Sant Boi de Llobregat', 2.0500, 41.3299],
  'muni-sant-climent-de-llobregat': ['Sant Climent de Llobregat', 1.9814, 41.3304],
  'muni-sant-cugat-del-vallès': ['Sant Cugat del Vallès', 2.0665, 41.4695],
  'muni-sant-feliu-de-llobregat': ['Sant Feliu de Llobregat', 2.0455, 41.3900],
  'muni-sant-joan-despí': ['Sant Joan Despí', 2.0530, 41.3696],
  'muni-sant-just-desvern': ['Sant Just Desvern', 2.0720, 41.3869],
  'muni-sant-vicenç-dels-horts': ['Sant Vicenç dels Horts', 2.0070, 41.3920],
  'muni-santa-coloma-de-cervelló': ['Santa Coloma de Cervelló', 2.0214, 41.3705],
  'muni-santa-coloma-de-gramenet': ['Santa Coloma de Gramenet', 2.2062, 41.4594],
  'muni-tiana': ['Tiana', 2.2670, 41.4858],
  'muni-torrelles-de-llobregat': ['Torrelles de Llobregat', 1.9610, 41.3514],
  'muni-viladecans': ['Viladecans', 2.0377, 41.2975],
}

describe('areas.geojson', () => {
  it('keeps 10 districts and 73 barris', () => {
    expect(byKind('district')).toHaveLength(10)
    expect(byKind('barri')).toHaveLength(73)
  })

  it('has the 35 AMB municipalities with stable ids and display names', () => {
    const munis = byKind('municipality')
    expect(munis.map((m) => m.properties.id).sort()).toEqual(Object.keys(MUNICIPALITIES).sort())
    for (const m of munis) expect(m.properties.name).toBe(MUNICIPALITIES[m.properties.id][0])
  })

  it('carries only id, name, kind and parent on every feature', () => {
    for (const a of areas) {
      expect(Object.keys(a.properties).every((k) => ['id', 'name', 'kind', 'parent'].includes(k))).toBe(true)
    }
  })

  it('draws each municipality around a point deep inside it', () => {
    for (const m of byKind('municipality')) {
      const [, lng, lat] = MUNICIPALITIES[m.properties.id]
      expect(booleanPointInPolygon([lng, lat], m), m.properties.id).toBe(true)
    }
  })

  it('keeps every municipality inside the metro area window and non-trivial', () => {
    for (const m of byKind('municipality')) {
      const [w, s, e, n] = bbox(m)
      expect(w).toBeGreaterThan(1.8)
      expect(e).toBeLessThan(2.4)
      expect(s).toBeGreaterThan(41.2)
      expect(n).toBeLessThan(41.6)
      expect(e - w).toBeGreaterThan(0.01)
    }
  })
})
