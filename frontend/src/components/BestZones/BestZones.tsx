import { useEffect } from 'react'
import { ActionIcon, Button, Checkbox, Group, Paper, Popover, Slider, Text } from '@mantine/core'
import { IconSettings, IconX } from '@tabler/icons-react'
import { useMap } from '../Map/MapContext'
import { useStore } from '../../store'
import { useBestZones } from '../../hooks/useBestZones'
import { BestZonesLayer } from './BestZonesLayer'
import { BaseUrlInput } from './BaseUrlInput'
import { visibleBounds } from '../Map/visibleBounds'
import { features } from '../../features'
import { TOP_PCT_STEPS, stepIndex } from '../../services/bestZonesConfig'

/**
 * Floating best-zones bar (feature 038) + the zones it draws. "Draw best zones" turns zones on for
 * the visible area; from then on they follow the map until "Clear zones" / Esc. Rendered inside the
 * map context so it can read the viewport.
 */
export function BestZones({ withBar = true }: { /** The floating bar; the new filter panel has the same controls inside it (TODO-052). */ withBar?: boolean }) {
  const map = useMap()
  const visible = useStore((s) => s.compositeVisible)
  const bounds = useStore((s) => s.bestZonesBounds)
  const setBounds = useStore((s) => s.setBestZonesBounds)
  const topPct = useStore((s) => s.bestZonesTopPct)
  const setTopPct = useStore((s) => s.setBestZonesTopPct)
  const restrict = useStore((s) => s.bestZonesRestrict)
  const setRestrict = useStore((s) => s.setBestZonesRestrict)
  const setCount = useStore((s) => s.setBestZonesCount)
  const { zones, urls, labels, ready } = useBestZones()

  // The panel's "Best areas" block says how many areas there are.
  const count = bounds && ready ? zones.length : null
  useEffect(() => { setCount(count) }, [count, setCount])
  useEffect(() => () => setCount(null), [setCount])

  // While zones are on, they follow the map: every pan/zoom redraws them for the new view.
  useEffect(() => {
    if (!map) return
    const onMoveEnd = () => { if (useStore.getState().bestZonesBounds) setBounds(visibleBounds(map)) }
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
      {withBar && <Paper className="glass-panel best-zones-bar" p="xs" radius="md">
        <Group gap={6} wrap="nowrap">
          {bounds ? (
            <Button size="xs" variant="default" onClick={() => setBounds(null)} title="Esc"
              leftSection={<IconX size={14} />} style={{ flex: 1 }}>
              Clear zones
            </Button>
          ) : (
            <Button size="xs" onClick={() => setBounds(visibleBounds(map!))} disabled={!map}
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
      </Paper>}
    </>
  )
}
