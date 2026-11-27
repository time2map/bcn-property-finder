import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  DATA_SOURCES, MAP_CREDIT, sourceById, sourceDate, visibleSources, COMMERCIAL_REVIEW_IDS,
} from './dataSources'

describe('data source registry', () => {
  it('has unique ids', () => {
    const ids = DATA_SOURCES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(DATA_SOURCES.map((s) => [s.id, s] as const))('%s names its publisher, dataset and licence', (_id, s) => {
    expect(s.publisher.trim()).not.toBe('')
    expect(s.dataset.trim()).not.toBe('')
    expect(s.licence.name.trim()).not.toBe('')
    if (s.licence.url) expect(s.licence.url).toMatch(/^https:\/\//)
    expect(s.url).toMatch(/^https:\/\//)
  })

  it('credits the sources every user sees on the map line', () => {
    const credit = MAP_CREDIT.map((c) => c.text).join(' ')
    expect(credit).toContain('ICGC')
    expect(credit).toContain('OpenStreetMap contributors')
    expect(credit).toContain('Dirección General del Catastro')
    for (const c of MAP_CREDIT) {
      expect(sourceById(c.source)).toBeDefined()
      expect(c.url).toMatch(/^https:\/\//)
    }
  })

  it('marks the sources whose terms are open for commercial use', () => {
    expect(COMMERCIAL_REVIEW_IDS).toEqual(
      expect.arrayContaining(['street-flooding', 'catastro', 'geoapify']),
    )
    for (const id of COMMERCIAL_REVIEW_IDS) expect(sourceById(id)?.commercial).toBe('needs-terms')
    expect(sourceById('street-flooding')?.licence.name).toMatch(/no licence/i)
  })

  it('formats the date a source was fetched, falling back to the build date', () => {
    const catastro = sourceById('catastro')!
    expect(sourceDate(catastro, { generated: '2026-11-04', sources: { catastro: '2026-05-21' } })).toBe('2026-05-21')
    expect(sourceDate(catastro, { generated: '2026-11-04' })).toBe('2026-11-04')
    expect(sourceDate(catastro, undefined)).toBeUndefined()
    // Live services have no build date.
    expect(sourceDate(sourceById('fgc')!, { generated: '2026-11-04' })).toBeUndefined()
    // A source with a fixed edition (noise map 2022) keeps it.
    expect(sourceDate(sourceById('noise-bcn')!, { generated: '2026-11-04' })).toBe('2022')
  })

  it('hides the sources of switched-off features', () => {
    const on = visibleSources({ facadePhoto: false, commercialUse: false }).map((s) => s.id)
    expect(on).not.toContain('catastro-photo')
    expect(on).toContain('osm')
    const commercial = visibleSources({ facadePhoto: false, commercialUse: true }).map((s) => s.id)
    expect(commercial).not.toContain('street-flooding')
    expect(commercial).toContain('tmb') // free licence, commercial use allowed when declared in the application
    expect(commercial).toContain('fgc') // CC BY 4.0 on FGC's open-data portal
  })

  it('covers every attribution string written in the layer code', () => {
    const dir = join(__dirname, '..', 'components')
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/Layer\.tsx$/.test(f)) files.push(p)
      }
    }
    walk(dir)
    const missing = files.filter((f) => /attribution\s*:/.test(readFileSync(f, 'utf8')) && !sourceLayerFor(f))
    expect(missing).toEqual([])
  })
})

/** The registry lists each layer component under `layers`. */
function sourceLayerFor(file: string) {
  const name = file.split('/').pop()!.replace('.tsx', '')
  return DATA_SOURCES.some((s) => s.layers.includes(name))
}
