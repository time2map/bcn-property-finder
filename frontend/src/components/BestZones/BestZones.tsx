import { useEffect } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { ActionIcon, Button, Checkbox, Group, Paper, Popover, Slider, Text } from '@mantine/core'
import { IconSettings, IconX } from '@tabler/icons-react'
import { useMap } from '../Map/MapContext'
import { useStore } from '../../store'
import { useBestZones } from '../../hooks/useBestZones'
import { BestZonesLayer } from './BestZonesLayer'
import { BaseUrlInput } from './BaseUrlInput'
import type { Bounds } from '../../services/bestZones'
import { features } from '../../features'

// Strictness steps as "top X% of visible hexes" — slider left = loose, right = strict.
// Above ~25% the good areas merge into one city-wide blob, so the loose end stops there.
const TOP_PCT_STEPS = [25, 20, 15, 10, 7, 5]

/**
 * Visible part of the map: the viewport minus the left filter panel and the right hex detail card
 * (when open) — zones should never hide under them.
 */
function viewOf(map: maplibregl.Map): Bounds {
  const box = map.getContainer().getBoundingClientRect()
  const mid = box.left + box.width / 2
  let left = 0
  let right = box.width
  const panel = document.querySelector('.top-panel')?.getBoundingClientRect()
  if (panel && panel.right < mid) left = Math.max(0, panel.right - box.left)
  const card = document.querySelector('.hex-detail-overlay')?.getBoundingClientRect()
  if (card && card.left > mid) right = Math.min(box.width, card.left - box.left)
  const corners = [[left, 0], [right, 0], [right, box.height], [left, box.height]]
    .map(([x, y]) => map.unproject([x, y]))
  const lngs = corners.map((c) => c.lng)
  const lats = corners.map((c) => c.lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

function stepIndex(topPct: number): number {
  const i = TOP_PCT_STEPS.findIndex((p) => p <= topPct)
  return i === -1 ? TOP_PCT_STEPS.length - 1 : i
}

/**
 * Floating best-zones bar (feature 038) + the zones it draws. "Draw best zones" turns zones on for
 * the visible area; from then on they follow the map until "Clear zones" / Esc. Rendered inside the
 * map context so it can read the viewport.
 */
export function BestZones() {
  const map = useMap()
  const visible = useStore((s) => s.compositeVisible)
  const bounds = useStore((s) => s.bestZonesBounds)
  const setBounds = useStore((s) => s.setBestZonesBounds)
  const topPct = useStore((s) => s.bestZonesTopPct)
  const setTopPct = useStore((s) => s.setBestZonesTopPct)
  const restrict = useStore((s) => s.bestZonesRestrict)
  const setRestrict = useStore((s) => s.setBestZonesRestrict)
  const { zones, urls, labels, ready } = useBestZones()

  // While zones are on, they follow the map: every pan/zoom redraws them for the new view.
  useEffect(() => {
    if (!map) return
    const onMoveEnd = () => { if (useStore.getState().bestZonesBounds) setBounds(viewOf(map)) }
    map.on('moveend', onMoveEnd)
    return () => { map.off('moveend', onMoveEnd) }
  }, [map, setBounds])

  useEffect(() => {
    if (!bounds) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBounds(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bounds, setBounds])

  if (!visible) return null

  return (
    <>
      <BestZonesLayer zones={zones} urls={urls} labels={labels} />
      <Paper className="glass-panel best-zones-bar" p="xs" radius="md">
        <Group gap={6} wrap="nowrap">
          {bounds ? (
            <Button size="xs" variant="default" onClick={() => setBounds(null)} title="Esc"
              leftSection={<IconX size={14} />} style={{ flex: 1 }}>
              Clear zones
            </Button>
          ) : (
            <Button size="xs" onClick={() => setBounds(viewOf(map!))} disabled={!map}
              style={{ flex: 1, backgroundColor: '#F06965' }}>
              Draw best zones
            </Button>
          )}
          <Popover width={300} position="top-end" withArrow>
            <Popover.Target>
              <ActionIcon variant="default" size={30} aria-label="Idealista filters" title="Idealista search filters">
                <IconSettings size={16} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Text size="xs" c="dimmed" mb={6}>Zone links reuse the filters from this Idealista search:</Text>
              <BaseUrlInput />
            </Popover.Dropdown>
          </Popover>
        </Group>
        <Group gap={8} wrap="nowrap" mt={8}>
          <Text size="xs" c="dimmed">Strictness</Text>
          <Slider
            style={{ flex: 1, '--slider-color': '#F06965' } as React.CSSProperties}
            size="xs"
            min={0}
            max={TOP_PCT_STEPS.length - 1}
            step={1}
            value={stepIndex(topPct)}
            onChange={(i) => setTopPct(TOP_PCT_STEPS[i])}
            label={null}
            thumbLabel="Strictness"
          />
          <Text size="xs" style={{ width: 52, textAlign: 'right' }}>top {topPct}%</Text>
        </Group>
        {(features.isochrone || features.exclusions) && (
          <Checkbox
            mt={8}
            size="xs"
            color="#F06965"
            label="Inside commute zone, outside exclusion zones"
            checked={restrict}
            onChange={(e) => setRestrict(e.currentTarget.checked)}
          />
        )}
        {ready && zones.length === 0 && (
          <Text size="xs" c="dimmed" mt={6}>No zones fit this view — zoom out</Text>
        )}
      </Paper>
    </>
  )
}
