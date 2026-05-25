import { useRef, useState } from 'react'
import { Badge } from '@mantine/core'
import { usePinsStore } from '../../store/pinsStore'
import type { PropertyPin } from '../../types/pins'
import { PhotoLightbox } from './PhotoLightbox'
import { compressImage } from '../../services/imageUtils'

const MAX_PANEL_H = 320
const MAX_PHOTOS = 5

function sortPins(pins: PropertyPin[]): PropertyPin[] {
  return [...pins].sort((a, b) => {
    const ia = a.analytics?.travelIndex
    const ib = b.analytics?.travelIndex
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

interface LightboxState { pinId: string; idx: number }

export function PinCompareTable() {
  const { pins, selectedPinId, setSelectedPin, updatePin, deletePin } = usePinsStore()
  const [collapsed, setCollapsed] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  if (pins.length === 0) return null

  const sorted = sortPins(pins)

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

  return (
    <>
      <div
        className="compare-panel"
        style={{ maxHeight: collapsed ? 40 : MAX_PANEL_H }}
      >
        <div
          className="compare-panel__toggle"
          onClick={() => setCollapsed((c) => !c)}
          role="button"
          aria-label={collapsed ? 'Expand comparison table' : 'Collapse comparison table'}
        >
          <span className="compare-panel__title">Apartments ({pins.length})</span>
          <span className="compare-panel__chevron">{collapsed ? '▴' : '▾'}</span>
        </div>

        {!collapsed && (
          <div className="compare-panel__body">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="compare-table__col-rank">#</th>
                  <th className="compare-table__col-header">Photos</th>
                  <th className="compare-table__col-header">Price, €</th>
                  <th className="compare-table__col-header">Area, m²</th>
                  <th className="compare-table__col-header">€/m²</th>
                  <th className="compare-table__col-header">🚶</th>
                  <th className="compare-table__col-header">🚌</th>
                  <th className="compare-table__col-header">🚲</th>
                  <th className="compare-table__col-header">🚗</th>
                  <th className="compare-table__col-header">Score</th>
                  <th className="compare-table__col-header">URL</th>
                  <th className="compare-table__col-header">Comment</th>
                  <th className="compare-table__col-header" />
                </tr>
              </thead>

              <tbody>
                {sorted.map((pin, i) => (
                  <tr
                    key={pin.id}
                    className={`compare-table__row${pin.id === selectedPinId ? ' compare-table__row--selected' : ''}`}
                    onClick={() => setSelectedPin(pin.id === selectedPinId ? null : pin.id)}
                  >
                    {/* Rank */}
                    <td className="compare-table__col-rank compare-table__rank-cell">
                      #{i + 1}
                    </td>

                    {/* Photos */}
                    <td
                      className="compare-table__cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="compare-table__photos">
                        {pin.photos?.map((src, idx) => (
                          <img
                            key={idx}
                            src={src}
                            alt="Property photo"
                            className="compare-table__thumb"
                            onClick={() => setLightbox({ pinId: pin.id, idx })}
                          />
                        ))}
                        {(pin.photos?.length ?? 0) < MAX_PHOTOS && (
                          <>
                            <button
                              className="compare-table__add-photo"
                              onClick={() => fileInputRefs.current.get(pin.id)?.click()}
                              aria-label="Add photo"
                            >
                              +
                            </button>
                            <input
                              ref={(el) => {
                                if (el) fileInputRefs.current.set(pin.id, el)
                                else fileInputRefs.current.delete(pin.id)
                              }}
                              type="file"
                              accept="image/*"
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => handlePhotos(pin.id, e.target.files)}
                            />
                          </>
                        )}
                      </div>
                    </td>

                    {/* Price */}
                    <td
                      className="compare-table__cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        className="compare-table__input"
                        defaultValue={pin.price ?? ''}
                        placeholder="—"
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value)
                          updatePin(pin.id, { price: isNaN(val) ? undefined : val })
                        }}
                        aria-label="Price"
                      />
                    </td>

                    {/* Area */}
                    <td
                      className="compare-table__cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        className="compare-table__input"
                        defaultValue={pin.area ?? ''}
                        placeholder="—"
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value)
                          updatePin(pin.id, { area: isNaN(val) ? undefined : val })
                        }}
                        aria-label="Area"
                      />
                    </td>

                    {/* €/m² */}
                    <td className="compare-table__cell compare-table__cell--derived">
                      {pin.price && pin.area
                        ? `€${Math.round(pin.price / pin.area).toLocaleString()}`
                        : '—'}
                    </td>

                    {/* Walking */}
                    <td className="compare-table__cell">
                      {fmt(pin.analytics?.walkingMinutes)}
                    </td>

                    {/* Transit */}
                    <td className="compare-table__cell">
                      {fmt(pin.analytics?.publicTransportMinutes)}
                    </td>

                    {/* Cycling */}
                    <td className="compare-table__cell">
                      {fmt(pin.analytics?.cyclingMinutes)}
                    </td>

                    {/* Driving */}
                    <td className="compare-table__cell">
                      {fmt(pin.analytics?.drivingMinutes)}
                    </td>

                    {/* Score */}
                    <td className="compare-table__cell">
                      {pin.analytics?.travelIndex !== undefined ? (
                        <Badge
                          size="xs"
                          color={indexColor(pin.analytics.travelIndex)}
                          variant="light"
                        >
                          {pin.analytics.travelIndex}
                        </Badge>
                      ) : '—'}
                    </td>

                    {/* URL */}
                    <td
                      className="compare-table__cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="url"
                          className="compare-table__input"
                          defaultValue={pin.url ?? ''}
                          placeholder="https://…"
                          onBlur={(e) => updatePin(pin.id, { url: e.target.value || undefined })}
                          aria-label="Listing URL"
                        />
                        {pin.url && (
                          <a
                            href={pin.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="compare-table__link"
                          >
                            ↗
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Comment */}
                    <td
                      className="compare-table__cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        className="compare-table__input compare-table__textarea"
                        defaultValue={pin.comment ?? ''}
                        placeholder="Notes…"
                        rows={1}
                        onBlur={(e) => updatePin(pin.id, { comment: e.target.value || undefined })}
                        aria-label="Comment"
                      />
                    </td>

                    {/* Delete */}
                    <td
                      className="compare-table__cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="compare-table__delete-btn"
                        onClick={() => deletePin(pin.id)}
                        aria-label={`Delete apartment ${i + 1}`}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
