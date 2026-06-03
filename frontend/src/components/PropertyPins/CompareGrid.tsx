import { useRef, useState } from 'react'
import { Badge, Menu, Tooltip } from '@mantine/core'
import { usePinsStore } from '../../store/pinsStore'
import { useExclusionsStore } from '../../store/exclusionsStore'
import { isPointInExclusions } from '../../services/exclusions'
import type { PropertyPin } from '../../types/pins'
import type { ServiceResult } from '../../services/walkability/walkabilityTypes'
import { PhotoLightbox } from './PhotoLightbox'
import { compressImage } from '../../services/imageUtils'
import { computeCompositeScore } from '../../services/analytics'
import { SERVICE_CATEGORIES } from '../../services/walkability/serviceCategories'
import { COMPARE_METRICS, computeBests } from './compareHighlight'

const MAX_PHOTOS = 5

const METRIC_GET = Object.fromEntries(
  COMPARE_METRICS.map((m) => [m.key, m.get]),
) as Record<string, (pin: PropertyPin) => number | undefined>

const stop = (e: React.MouseEvent) => e.stopPropagation()

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

// ─── Editable cells ───────────────────────────────────────────────

/** Number input that shows a thousands-formatted, €-prefixed value when blurred. */
function PriceCell({ value, onCommit }: { value?: number; onCommit: (v: number | undefined) => void }) {
  const display = value !== undefined ? `€${value.toLocaleString('en-US')}` : ''
  return (
    <input
      className="compare-grid__input compare-grid__input--price"
      defaultValue={display}
      placeholder="—"
      inputMode="numeric"
      onClick={stop}
      onFocus={(e) => {
        e.target.value = value !== undefined ? String(value) : ''
        e.target.select()
      }}
      onBlur={(e) => {
        const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''))
        const v = isNaN(n) ? undefined : n
        onCommit(v)
        e.target.value = v !== undefined ? `€${v.toLocaleString('en-US')}` : ''
      }}
      aria-label="Price"
    />
  )
}

/** Compact listing-URL control: add → edit → open + menu (copy / edit / remove). */
function UrlCell({ url, onCommit }: { url?: string; onCommit: (v: string | undefined) => void }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <input
        type="url"
        className="compare-grid__input"
        autoFocus
        defaultValue={url ?? ''}
        placeholder="https://…"
        aria-label="Listing URL"
        onClick={stop}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        onBlur={(e) => {
          onCommit(e.target.value.trim() || undefined)
          setEditing(false)
        }}
      />
    )
  }

  if (!url) {
    return (
      <button
        className="compare-grid__url-add"
        aria-label="Add listing URL"
        onClick={(e) => { stop(e); setEditing(true) }}
      >
        + link
      </button>
    )
  }

  return (
    <div className="compare-grid__url" onClick={stop}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="compare-grid__url-link"
        aria-label="Open listing"
      >
        🔗 Listing
      </a>
      <Menu position="bottom-end" withinPortal={false}>
        <Menu.Target>
          <button className="compare-grid__url-menu" aria-label="Listing options">⋯</button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => navigator.clipboard?.writeText(url)}>Copy link</Menu.Item>
          <Menu.Item onClick={() => setEditing(true)}>Edit</Menu.Item>
          <Menu.Item color="red" onClick={() => onCommit(undefined)}>Remove</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  )
}

/** Settable 1–10 subjective rating shown as a clickable dot scale. */
function RatingCell({ value, onCommit }: { value?: number; onCommit: (v: number | undefined) => void }) {
  const tier = value === undefined ? ''
    : value >= 8 ? ' compare-grid__rating--high'
    : value >= 5 ? ' compare-grid__rating--mid'
    : ' compare-grid__rating--low'
  return (
    <div className={`compare-grid__rating${tier}`} onClick={stop}>
      <div className="compare-grid__rating-dots">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={`compare-grid__rating-dot${value !== undefined && n <= value ? ' compare-grid__rating-dot--on' : ''}`}
            aria-label={`Rate ${n} out of 10`}
            onClick={() => onCommit(n === value ? undefined : n)}
          />
        ))}
      </div>
      <span className="compare-grid__rating-num">{value !== undefined ? `${value}/10` : '—'}</span>
    </div>
  )
}

interface LightboxState { pinId: string; idx: number }

interface RowDef {
  key: string
  label: React.ReactNode
  metric?: string
  render: (pin: PropertyPin) => React.ReactNode
}

export function CompareGrid() {
  const { pins, selectedPinId, setSelectedPin, updatePin, deletePin } = usePinsStore()
  const zones = useExclusionsStore((s) => s.zones)
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

  function openCover(pin: PropertyPin) {
    if (pin.photos?.length) setLightbox({ pinId: pin.id, idx: 0 })
    else fileInputRefs.current.get(pin.id)?.click()
  }

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
    { key: 'rating', label: '⭐ My rating', render: (p) => <RatingCell value={p.rating} onCommit={(v) => updatePin(p.id, { rating: v })} /> },
    { key: 'price', label: 'Price', metric: 'price', render: (p) => <PriceCell value={p.price} onCommit={(v) => updatePin(p.id, { price: v })} /> },
    { key: 'area', label: 'Area, m²', metric: 'area', render: (p) => numInput(p.area, 'Area', (v) => updatePin(p.id, { area: v })) },
    {
      key: 'ppm2', label: '€/m²', metric: 'pricePerM2',
      render: (p) => (p.price && p.area ? `€${Math.round(p.price / p.area).toLocaleString('en-US')}` : '—'),
    },
    {
      key: 'rooms', label: 'Rooms',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, whiteSpace: 'nowrap' }} onClick={stop}>
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
    { key: 'url', label: 'Listing', render: (p) => <UrlCell url={p.url} onCommit={(v) => updatePin(p.id, { url: v })} /> },
    {
      key: 'comment', label: 'Notes',
      render: (p) => (
        <textarea
          className="compare-grid__input compare-grid__textarea" defaultValue={p.comment ?? ''}
          placeholder="Notes…" rows={5} onClick={stop}
          onBlur={(e) => updatePin(p.id, { comment: e.target.value || undefined })} aria-label="Comment"
        />
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
            <th className="compare-grid__corner">
              <span className="compare-grid__corner-label">Location<br />score ↓</span>
            </th>
            {sorted.map((pin, i) => {
              const score = compositeScore(pin)
              const photoCount = pin.photos?.length ?? 0
              const excluded = isPointInExclusions(pin.coordinates, zones)
              return (
                <th
                  key={pin.id}
                  className={`compare-grid__head${pin.id === selectedPinId ? ' compare-grid__head--selected' : ''}`}
                  onClick={() => setSelectedPin(pin.id === selectedPinId ? null : pin.id)}
                >
                  <div className="compare-grid__card">
                    <div className="compare-grid__card-top">
                      <span className="compare-grid__rank">#{i + 1}</span>
                      <button
                        className="compare-grid__delete"
                        onClick={(e) => { e.stopPropagation(); deletePin(pin.id) }}
                        aria-label={`Delete apartment ${i + 1}`}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>

                    {excluded && (
                      <Badge size="xs" color="red" variant="light" mb={4}>
                        ⛔ In excluded area
                      </Badge>
                    )}

                    <div
                      className="compare-grid__cover"
                      onClick={(e) => { e.stopPropagation(); openCover(pin) }}
                      title={photoCount ? 'Open gallery' : 'Add photos'}
                    >
                      {pin.photos?.[0]
                        ? <img src={pin.photos[0]} alt="Property photo" />
                        : <div className="compare-grid__cover-empty">🏠</div>}
                      {photoCount > 1 && <span className="compare-grid__photo-count">⊞ {photoCount}</span>}
                      {photoCount < MAX_PHOTOS && (
                        <button
                          className="compare-grid__add-photo"
                          onClick={(e) => { e.stopPropagation(); fileInputRefs.current.get(pin.id)?.click() }}
                          aria-label="Add photo"
                        >
                          +
                        </button>
                      )}
                      <input
                        ref={(el) => {
                          if (el) fileInputRefs.current.set(pin.id, el)
                          else fileInputRefs.current.delete(pin.id)
                        }}
                        type="file" accept="image/*" multiple style={{ display: 'none' }}
                        onChange={(e) => handlePhotos(pin.id, e.target.files)}
                      />
                    </div>

                    {score !== undefined ? (
                      <div className="compare-grid__score">
                        <Badge size="md" color={indexColor(score)} variant="filled">{score}</Badge>
                        <div className="compare-grid__score-bar">
                          <span style={{ width: `${score}%`, background: `var(--mantine-color-${indexColor(score)}-6)` }} />
                        </div>
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
