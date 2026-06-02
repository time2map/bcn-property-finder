import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { IdealistaHTMLParser, buildPinComment } from './IdealistaHTMLParser'

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../..',
  "data/Flat _ apartment for sale in Calle de Llull, La Vila Olímpica del Poblenou, Barcelona — idealista.html",
)
const fixtureHtml = fs.readFileSync(FIXTURE_PATH, 'utf-8')

describe('IdealistaHTMLParser — fixture', () => {
  const result = new IdealistaHTMLParser(fixtureHtml).parse()

  it('extracts id', () => {
    expect(result.id).toBe('110784254')
  })

  it('extracts url', () => {
    expect(result.url).toBe('https://www.idealista.com/en/inmueble/110784254/')
  })

  it('extracts price', () => {
    expect(result.price).toBe(379000)
  })

  it('extracts pricePerSqm', () => {
    expect(result.pricePerSqm).toBe(5922)
  })

  it('extracts area', () => {
    expect(result.areaSqm).toBe(64)
  })

  it('extracts bedrooms', () => {
    expect(result.bedrooms).toBe(2)
  })

  it('extracts bathrooms', () => {
    expect(result.bathrooms).toBe(1)
  })

  it('extracts street', () => {
    expect(result.street).toBe('Calle de Llull')
  })

  it('extracts neighborhood', () => {
    expect(result.neighborhood).toBe('La Vila Olímpica del Poblenou')
  })

  it('extracts city', () => {
    expect(result.city).toBe('Barcelona')
  })

  it('extracts floor', () => {
    expect(result.floor).toMatch(/6th floor/i)
  })

  it('extracts hasLift', () => {
    expect(result.hasLift).toBe(true)
  })

  it('extracts yearBuilt', () => {
    expect(result.yearBuilt).toBe(1974)
  })

  it('extracts orientation', () => {
    expect(result.orientation).toContain('South')
    expect(result.orientation).toContain('East')
    expect(result.orientation).toContain('West')
  })

  it('extracts condition', () => {
    expect(result.condition).toMatch(/second hand/i)
  })

  it('extracts amenities', () => {
    expect(result.amenities).toContain('Air conditioning')
  })

  it('extracts description', () => {
    expect(result.description.length).toBeGreaterThan(50)
    expect(result.description).toMatch(/RFG Properties/i)
  })

  it('extracts energyConsumption', () => {
    expect(result.energyConsumption).toMatch(/152/)
  })

  it('extracts energyCO2', () => {
    expect(result.energyCO2).toMatch(/34/)
  })

  it('extracts photos (XL resolution)', () => {
    expect(result.photos.length).toBeGreaterThan(5)
    expect(result.photos.every(u => u.includes('WEB_DETAIL-XL-L'))).toBe(true)
  })

  it('photos are unique', () => {
    expect(new Set(result.photos).size).toBe(result.photos.length)
  })
})

describe('IdealistaHTMLParser — minimal HTML', () => {
  it('returns safe defaults when fields are absent', () => {
    const result = new IdealistaHTMLParser('<html><body></body></html>').parse()
    expect(result.id).toBe('')
    expect(result.price).toBe(0)
    expect(result.areaSqm).toBe(0)
    expect(result.bedrooms).toBe(0)
    expect(result.bathrooms).toBe(0)
    expect(result.yearBuilt).toBeNull()
    expect(result.orientation).toEqual([])
    expect(result.amenities).toEqual([])
    expect(result.photos).toEqual([])
    expect(result.energyConsumption).toBeNull()
    expect(result.energyCO2).toBeNull()
  })

  it('parses price correctly from strong.price', () => {
    const html = `<html><body><strong class="price">450,000 €</strong></body></html>`
    expect(new IdealistaHTMLParser(html).parse().price).toBe(450000)
  })

  it('parses yearBuilt from Basic features li', () => {
    const html = `<html><body>
      <h2 class="details-property-h2">Basic features</h2>
      <div class="details-property_features"><ul>
        <li>Built in 2005</li>
      </ul></div>
    </body></html>`
    expect(new IdealistaHTMLParser(html).parse().yearBuilt).toBe(2005)
  })

  it('parses hasLift false when not present', () => {
    const html = `<html><body>
      <h2 class="details-property-h2">Building</h2>
      <div class="details-property_features"><ul>
        <li>3rd floor exterior</li>
      </ul></div>
    </body></html>`
    expect(new IdealistaHTMLParser(html).parse().hasLift).toBe(false)
  })
})

describe('buildPinComment', () => {
  it('includes address on first line', () => {
    const result = new IdealistaHTMLParser(fixtureHtml).parse()
    const comment = buildPinComment(result)
    expect(comment.startsWith('Calle de Llull')).toBe(true)
  })

  it('includes orientation', () => {
    const result = new IdealistaHTMLParser(fixtureHtml).parse()
    const comment = buildPinComment(result)
    expect(comment).toMatch(/Orientation:.*South/i)
  })

  it('includes year and floor on same line', () => {
    const result = new IdealistaHTMLParser(fixtureHtml).parse()
    const comment = buildPinComment(result)
    expect(comment).toMatch(/1974/)
    expect(comment).toMatch(/6th/)
  })

  it('includes energy info', () => {
    const result = new IdealistaHTMLParser(fixtureHtml).parse()
    const comment = buildPinComment(result)
    expect(comment).toMatch(/Energy:.*152/)
  })

  it('includes description', () => {
    const result = new IdealistaHTMLParser(fixtureHtml).parse()
    const comment = buildPinComment(result)
    expect(comment).toMatch(/RFG Properties/)
  })
})
