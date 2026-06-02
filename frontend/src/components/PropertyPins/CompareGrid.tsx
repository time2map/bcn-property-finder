import { useRef, useState } from 'react'
import { Badge, Tooltip } from '@mantine/core'
import { usePinsStore } from '../../store/pinsStore'
import type { PropertyPin } from '../../types/pins'
import type { ServiceResult } from '../../services/walkability/walkabilityTypes'
import { PhotoLightbox } from './PhotoLightbox'
import { compressImage } from '../../services/imageUtils'
import { computeCompositeScore } from '../../services/analytics'
import { SERVICE_CATEGORIES } from '../../services/walkability/serviceCategories'
import { COMPARE_METRICS, computeBests } from './compareHighlight'

const MAX_PHOTOS = 5

// Accessor for each comparable metric, keyed by metric id (shared with computeBests).
const METRIC_GET = Object.fromEntries(
  COMPARE_METRICS.map((m) => [m.key, m.get]),
) as Record<string, (pin: PropertyPin) => number | undefined>

function compositeScore(pin: PropertyPin): number | undefined {
  return pin.analytics ? computeCompositeScore(pin.analytics) : undefined
}

function sortPins(pins: PropertyPin[]): PropertyPin[] {
  return [...pins].sort((a, b) => {
    const ia = compositeScore(a)
    const ib = compositeScore(b)
    if (ia === undefined && ib === undefined) return 0
    if (ia === undefined) return 1
    if (ib === undefined) return -1
    return ib - ia
  })
}

function fmt(min: number | undefined): string {
  if (min === undefined) return '—'
  return `${Math.round(min)} min`
}

function indexColor(index: number | undefined): string {
  if (index === undefined) return 'gray'
  if (index >= 70) return 'green'
  if (index >= 40) return 'orange'
  return 'red'
}

function categoryBreakdown(services: ServiceResult[]) {
  return SERVICE_CATEGORIES.map((cat) => {
    const nearest = services
      .filter((s) => s.categoryId === cat.id)
      .sort((a, b) => a.walkingMinutes - b.walkingMinutes)[0]
    return { cat, nearest }
  })
}

function WalkabilityTooltip({ services }: { services: ServiceResult[] }) {
  const rows = categoryBreakdown(services)
  return (
    <div style={{ fontSize: 11, lineHeight: 1.6, minWidth: 180 }}>
      {rows.map(({ cat, nearest }) => (
        <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{cat.emoji} {cat.label}</span>
          {nearest ? (
            <span style={{ color: nearest.walkingMinutes <= 15 ? '#51cf66' : '#ffa94d', fontWeight: 600 }}>
              {nearest.walkingMinutes} min{nearest.name ? ` · ${nearest.name}` : ''}
            </span>
          ) : (
            <span style={{ color: '#868e96' }}>—</span>
          )}
        </div>
      ))}
    </div>
  )
}

interface LightboxState { pinId: string; idx: number }

// ─── Row definitions ──────────────────────────────────────────────
// Each attribute is one row; `metric` (when set) keys into computeBests for
// "best in row" highlighting and uses the shared accessor in METRIC_GET.
interface RowDef {
  key: string
  label: React.ReactNode
  metric?: string
  render: (pin: PropertyPin) => React.ReactNode
}

export function CompareGrid() {
  const { pins, selectedPinId, setSelectedPin, updatePin, deletePin } = usePinsStore()
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  if (pins.length === 0) return null

  const sorted = sortPins(pins)
  const bests = computeBests(sorted)

  const lbPin = lightbox ? sorted.find((p) => p.id === lightbox.pinId) : undefined
  const lbPhotos = lbPin?.photos ?? []
  const lbSrc = lightbox ? lbPhotos[lightbox.idx] : undefined

  async function handlePhotos(pinId: string, files: FileList | null) {
    if (!files) return
    const pin = pins.find((p) => p.id === pinId)
    if (!pin) return
    const current = pin.photos ?? []
    const remaining = MAX_PHOTOS - current.length
    if (remaining <= 0) return
    const compressed = await Promise.all(
      Array.from(files).slice(0, remaining).map(compressImage),
    )
    updatePin(pinId, { photos: [...current, ...compressed] })
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  // Editable number cell → commit on blur.
  const numInput = (
    current: number | undefined,
    label: string,
    commit: (value: number | undefined) => void,
  ) => (
    <input
      type="number"
      className="compare-grid__input"
      defaultValue={current ?? ''}
      placeholder="—"
      onClick={stop}
      onBlur={(e) => {
        const val = parseFloat(e.target.value)
        commit(isNaN(val) ? undefined : val)
      }}
      aria-label={label}
    />
  )

  const outdoorRows: RowDef[] = [
    { key: 'walk', label: '🚶 Walk', metric: 'walking', render: (p) => fmt(p.analytics?.walkingMinutes) },
    { key: 'transit', label: '🚌 Transit', metric: 'transit', render: (p) => fmt(p.analytics?.publicTransportMinutes) },
    { key: 'cycle', label: '🚲 Cycle', metric: 'cycling', render: (p) => fmt(p.analytics?.cyclingMinutes) },
    { key: 'drive', label: '🚗 Drive', metric: 'driving', render: (p) => fmt(p.analytics?.drivingMinutes) },
    {
      key: 'noise', label: '🔊 Noise', metric: 'noise',
      render: (p) => (p.analytics?.noiseLden !== undefined ? `${p.analytics.noiseLden} dB` : '—'),
    },
    {
      key: 'walkability', label: '🏙 Walkability', metric: 'walkability',
      render: (p) =>
        p.analytics?.walkabilityScore !== undefined && p.analytics.walkabilityServices ? (
          <Tooltip
            label={<WalkabilityTooltip services={p.analytics.walkabilityServices} />}
            multiline withArrow position="top" color="dark"
          >
            <Badge size="sm" color={indexColor(p.analytics.walkabilityScore)} variant="light" style={{ cursor: 'default' }}>
              {p.analytics.walkabilityScore}
            </Badge>
          </Tooltip>
        ) : '—',
    },
  ]

  const indoorRows: RowDef[] = [
    { key: 'price', label: 'Price, €', metric: 'price', render: (p) => numInput(p.price, 'Price', (v) => updatePin(p.id, { price: v })) },
    { key: 'area', label: 'Area, m²', metric: 'area', render: (p) => numInput(p.area, 'Area', (v) => updatePin(p.id, { area: v })) },
    {
      key: 'ppm2', label: '€/m²', metric: 'pricePerM2',
      render: (p) => (p.price && p.area ? `€${Math.round(p.price / p.area).toLocaleString()}` : '—'),
    },
    {
      key: 'rooms', label: 'Rooms',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }} onClick={stop}>
          <input
            type="number" className="compare-grid__input" style={{ width: 30, textAlign: 'center' }}
            defaultValue={p.bedrooms ?? ''} placeholder="bd"
            onBlur={(e) => updatePin(p.id, { bedrooms: e.target.value ? +e.target.value : undefined })}
            aria-label="Bedrooms"
          />
          <span style={{ color: '#868e96' }}>/</span>
          <input
            type="number" className="compare-grid__input" style={{ width: 30, textAlign: 'center' }}
            defaultValue={p.bathrooms ?? ''} placeholder="ba"
            onBlur={(e) => updatePin(p.id, { bathrooms: e.target.value ? +e.target.value : undefined })}
            aria-label="Bathrooms"
          />
        </div>
      ),
    },
    {
      key: 'floor', label: 'Floor',
      render: (p) => (
        <input
          className="compare-grid__input" defaultValue={p.floor ?? ''} placeholder="—" onClick={stop}
          onBlur={(e) => updatePin(p.id, { floor: e.target.value || undefined })} aria-label="Floor"
        />
      ),
    },
    { key: 'year', label: 'Year', render: (p) => numInput(p.yearBuilt, 'Year built', (v) => updatePin(p.id, { yearBuilt: v })) },
    {
      key: 'photos', label: 'Photos',
      render: (p) => (
        <div className="compare-grid__photos" onClick={stop}>
          {p.photos?.map((src, idx) => (
            <img
              key={idx} src={src} alt="Property photo" className="compare-grid__thumb"
              onClick={() => setLightbox({ pinId: p.id, idx })}
            />
          ))}
          {(p.photos?.length ?? 0) < MAX_PHOTOS && (
            <>
              <button
                className="compare-grid__add-photo"
                onClick={() => fileInputRefs.current.get(p.id)?.click()}
                aria-label="Add photo"
              >
                +
              </button>
              <input
                ref={(el) => {
                  if (el) fileInputRefs.current.set(p.id, el)
                  else fileInputRefs.current.delete(p.id)
                }}
                type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={(e) => handlePhotos(p.id, e.target.files)}
              />
            </>
          )}
        </div>
      ),
    },
    {
      key: 'url', label: 'URL',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={stop}>
          <input
            type="url" className="compare-grid__input" defaultValue={p.url ?? ''} placeholder="https://…"
            onBlur={(e) => updatePin(p.id, { url: e.target.value || undefined })} aria-label="Listing URL"
          />
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="compare-grid__link">↗</a>
          )}
        </div>
      ),
    },
    {
      key: 'comment', label: 'Notes',
      render: (p) => (
        <textarea
          className="compare-grid__input compare-grid__textarea" defaultValue={p.comment ?? ''}
          placeholder="Notes…" rows={2} onClick={stop}
          onBlur={(e) => updatePin(p.id, { comment: e.target.value || undefined })} aria-label="Comment"
        />
      ),
    },
    {
      key: 'visit', label: 'Visit',
      render: () => (
        <span className="compare-grid__visit-stub" title="Visit rating — coming soon" aria-hidden="true">
          ☆☆☆☆☆
        </span>
      ),
    },
  ]

  function bestClass(def: RowDef, pin: PropertyPin): string {
    if (!def.metric) return ''
    const best = bests[def.metric]
    const val = METRIC_GET[def.metric]?.(pin)
    return best !== undefined && val !== undefined && val === best ? ' compare-grid__cell--best' : ''
  }

  function renderRow(def: RowDef, zone: 'outdoor' | 'indoor') {
    return (
      <tr key={def.key} className="compare-grid__row">
        <th scope="row" className={`compare-grid__label compare-grid__label--${zone}`}>{def.label}</th>
        {sorted.map((pin) => (
          <td
            key={pin.id}
            className={
              `compare-grid__cell compare-grid__cell--${zone}` +
              (pin.id === selectedPinId ? ' compare-grid__cell--selected' : '') +
              bestClass(def, pin)
            }
          >
            {def.render(pin)}
          </td>
        ))}
      </tr>
    )
  }

  function sectionRow(label: string, zone: 'outdoor' | 'indoor') {
    return (
      <tr className="compare-grid__section">
        <td className={`compare-grid__section-cell compare-grid__section-cell--${zone}`} colSpan={sorted.length + 1}>
          {label}
        </td>
      </tr>
    )
  }

  return (
    <>
      <table className="compare-grid">
        <thead>
          <tr>
            <th className="compare-grid__corner" />
            {sorted.map((pin, i) => {
              const score = compositeScore(pin)
              return (
                <th
                  key={pin.id}
                  className={`compare-grid__head${pin.id === selectedPinId ? ' compare-grid__head--selected' : ''}`}
                  onClick={() => setSelectedPin(pin.id === selectedPinId ? null : pin.id)}
                >
                  <div className="compare-grid__card">
                    <div className="compare-grid__cover">
                      {pin.photos?.[0]
                        ? <img src={pin.photos[0]} alt="" />
                        : <div className="compare-grid__cover-empty">🏠</div>}
                      <button
                        className="compare-grid__delete"
                        onClick={(e) => { e.stopPropagation(); deletePin(pin.id) }}
                        aria-label={`Delete apartment ${i + 1}`}
                      >
                        🗑
                      </button>
                    </div>
                    <div className="compare-grid__rank">#{i + 1}</div>
                    {score !== undefined ? (
                      <div className="compare-grid__score">
                        <Badge size="lg" color={indexColor(score)} variant="filled">{score}</Badge>
                        <div className="compare-grid__score-bar">
                          <span style={{ width: `${score}%`, background: `var(--mantine-color-${indexColor(score)}-6)` }} />
                        </div>
                        <span className="compare-grid__score-label">Location</span>
                      </div>
                    ) : (
                      <div className="compare-grid__score compare-grid__score--empty">—</div>
                    )}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {sectionRow('Outdoor — location', 'outdoor')}
          {outdoorRows.map((r) => renderRow(r, 'outdoor'))}
          {sectionRow('Indoor — the flat', 'indoor')}
          {indoorRows.map((r) => renderRow(r, 'indoor'))}
        </tbody>
      </table>

      {lbSrc && (
        <PhotoLightbox
          src={lbSrc}
          hasPrev={lightbox!.idx > 0}
          hasNext={lightbox!.idx < lbPhotos.length - 1}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((s) => s ? { ...s, idx: s.idx - 1 } : null)}
          onNext={() => setLightbox((s) => s ? { ...s, idx: s.idx + 1 } : null)}
        />
      )}
    </>
  )
}
