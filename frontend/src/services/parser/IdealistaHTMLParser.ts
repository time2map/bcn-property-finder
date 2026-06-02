import type { IdealistaProperty } from '../../types/IdealistaProperty'

export class IdealistaHTMLParser {
  private doc: Document

  constructor(html: string) {
    this.doc = new DOMParser().parseFromString(html, 'text/html')
  }

  parse(): IdealistaProperty {
    return {
      id: this.parseId(),
      url: this.parseUrl(),
      price: this.parsePrice(),
      pricePerSqm: this.parsePricePerSqm(),
      areaSqm: this.parseArea(),
      bedrooms: this.parseBedrooms(),
      bathrooms: this.parseBathrooms(),
      street: this.parseStreet(),
      neighborhood: this.parseNeighborhood(),
      city: this.parseCity(),
      floor: this.parseFloor(),
      hasLift: this.parseHasLift(),
      yearBuilt: this.parseYearBuilt(),
      orientation: this.parseOrientation(),
      condition: this.parseCondition(),
      amenities: this.parseAmenities(),
      basicFeatures: this.parseBasicFeatures(),
      description: this.parseDescription(),
      energyConsumption: this.parseEnergyConsumption(),
      energyCO2: this.parseEnergyCO2(),
      photos: this.parsePhotos(),
    }
  }

  private parseUrl(): string {
    return this.doc.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? ''
  }

  private parseId(): string {
    return this.parseUrl().match(/inmueble\/(\d+)/)?.[1] ?? ''
  }

  private parsePrice(): number {
    const text = this.doc.querySelector('strong.price')?.textContent ?? ''
    return parseInt(text.replace(/\D/g, ''), 10) || 0
  }

  private parsePricePerSqm(): number {
    const els = this.doc.querySelectorAll('.flex-feature-details')
    for (const el of els) {
      if (el.textContent?.includes('€/m²')) {
        return parseInt(el.textContent.replace(/\D/g, ''), 10) || 0
      }
    }
    return 0
  }

  private parseArea(): number {
    for (const item of this.sectionItems('Basic features')) {
      const m = item.match(/^(\d+)\s*m²/)
      if (m) return parseInt(m[1], 10)
    }
    return 0
  }

  private parseBedrooms(): number {
    for (const item of this.sectionItems('Basic features')) {
      const m = item.match(/^(\d+)\s*bedrooms?/i)
      if (m) return parseInt(m[1], 10)
    }
    return 0
  }

  private parseBathrooms(): number {
    for (const item of this.sectionItems('Basic features')) {
      const m = item.match(/^(\d+)\s*bathrooms?/i)
      if (m) return parseInt(m[1], 10)
    }
    return 0
  }

  private parseStreet(): string {
    const text = this.doc.querySelector('.main-info__title-main')?.textContent?.trim() ?? ''
    // "Flat / apartment for sale in Calle de Llull" → "Calle de Llull"
    return text.replace(/^.+\bin\s+/i, '').trim()
  }

  private parseNeighborhood(): string {
    const text = this.doc.querySelector('.main-info__title-minor')?.textContent?.trim() ?? ''
    const parts = text.split(',')
    return parts.length > 1 ? parts.slice(0, -1).join(',').trim() : text.trim()
  }

  private parseCity(): string {
    const text = this.doc.querySelector('.main-info__title-minor')?.textContent?.trim() ?? ''
    const parts = text.split(',')
    return parts.length > 1 ? parts[parts.length - 1].trim() : ''
  }

  private parseFloor(): string {
    return this.sectionItems('Building').find(item => /floor/i.test(item)) ?? ''
  }

  private parseHasLift(): boolean {
    return this.sectionItems('Building').some(item => /with lift/i.test(item))
  }

  private parseYearBuilt(): number | null {
    for (const item of this.sectionItems('Basic features')) {
      const m = item.match(/Built in (\d{4})/i)
      if (m) return parseInt(m[1], 10)
    }
    return null
  }

  private parseOrientation(): string[] {
    for (const item of this.sectionItems('Basic features')) {
      const m = item.match(/^Orientation\s+(.+)/i)
      if (m) return m[1].split(/,\s*/).map(s => s.trim()).filter(Boolean)
    }
    return []
  }

  private parseCondition(): string {
    const knownConditions = [
      'new construction',
      'good condition',
      'second hand',
      'needs renovation',
      'to renovate',
    ]
    for (const item of this.sectionItems('Basic features')) {
      if (knownConditions.some(c => item.toLowerCase().includes(c))) return item
    }
    return ''
  }

  private parseAmenities(): string[] {
    return this.sectionItems('Amenities')
  }

  private parseBasicFeatures(): string[] {
    const skipPatterns = [
      /bedrooms?/i,
      /bathrooms?/i,
      /m²/,
      /^orientation/i,
      /built in \d/i,
      /new construction/i,
      /good condition/i,
      /second hand/i,
      /needs renovation/i,
      /to renovate/i,
    ]
    return this.sectionItems('Basic features').filter(
      item => !skipPatterns.some(re => re.test(item)),
    )
  }

  private parseDescription(): string {
    const el = this.doc.querySelector('.adCommentsLanguage p, div.comment p')
    return el?.textContent?.trim() ?? ''
  }

  private parseEnergyConsumption(): string | null {
    const spans = this.doc.querySelectorAll('span[class*="icon-energy-"]')
    return spans[0]?.textContent?.trim() || null
  }

  private parseEnergyCO2(): string | null {
    const spans = this.doc.querySelectorAll('span[class*="icon-energy-"]')
    return spans[1]?.textContent?.trim() || null
  }

  private parsePhotos(): string[] {
    const seen = new Set<string>()
    const result: string[] = []

    this.doc.querySelectorAll('[srcset]').forEach(el => {
      const srcset = el.getAttribute('srcset') ?? ''
      for (const part of srcset.split(',')) {
        const url = part.trim().split(/\s+/)[0]
        if (url.includes('WEB_DETAIL-XL-L') && !seen.has(url)) {
          seen.add(url)
          result.push(url)
        }
      }
    })

    if (result.length === 0) {
      const matches = this.doc.body.innerHTML.matchAll(
        /https:\/\/img[^"'\s]*WEB_DETAIL-XL-L[^"'\s]*/g,
      )
      for (const m of matches) {
        if (!seen.has(m[0])) { seen.add(m[0]); result.push(m[0]) }
      }
    }

    return result
  }

  private sectionItems(title: string): string[] {
    for (const h2 of this.doc.querySelectorAll('h2.details-property-h2')) {
      if (h2.textContent?.trim() === title) {
        const next = h2.nextElementSibling
        if (next) {
          return Array.from(next.querySelectorAll('li'))
            .map(li => li.textContent?.trim() ?? '')
            .filter(Boolean)
        }
      }
    }
    return []
  }
}

export function buildPinComment(p: IdealistaProperty): string {
  const lines: string[] = []

  lines.push(`${p.street}, ${p.neighborhood}`)
  lines.push('')

  if (p.orientation.length) lines.push(`Orientation: ${p.orientation.join(', ')}`)
  if (p.condition) lines.push(`Condition: ${p.condition}`)

  const allAmenities = [...p.amenities, ...p.basicFeatures]
  if (allAmenities.length) lines.push(`Amenities: ${allAmenities.join(', ')}`)

  const meta: string[] = []
  if (p.yearBuilt) meta.push(`Year: ${p.yearBuilt}`)
  if (p.floor) meta.push(`Floor: ${p.floor}`)
  if (p.hasLift) meta.push('Lift: yes')
  if (meta.length) lines.push(meta.join(' · '))

  const energy: string[] = []
  if (p.energyConsumption) energy.push(p.energyConsumption)
  if (p.energyCO2) energy.push(p.energyCO2)
  if (energy.length) lines.push(`Energy: ${energy.join(' · ')}`)

  if (p.description) {
    lines.push('')
    lines.push(p.description)
  }

  return lines.join('\n')
}
