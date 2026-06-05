import { useEffect, useMemo, useState } from 'react'
import { ActionIcon, Group, Select, Stack, Switch, Text, Button } from '@mantine/core'
import { useExclusionsStore } from '../../store/exclusionsStore'
import { getArea, listAreaOptions, loadAreas, type AreaFeature } from '../../services/areas'

/** Panel section for defining "no-go" exclusion zones (draw + add-by-area + active list). */
export function ExclusionControls() {
  const zones = useExclusionsStore((s) => s.zones)
  const drawingMode = useExclusionsStore((s) => s.drawingMode)
  const setDrawingMode = useExclusionsStore((s) => s.setDrawingMode)
  const addZone = useExclusionsStore((s) => s.addZone)
  const removeZone = useExclusionsStore((s) => s.removeZone)
  const exclusionsVisible = useExclusionsStore((s) => s.exclusionsVisible)
  const setExclusionsVisible = useExclusionsStore((s) => s.setExclusionsVisible)

  const [expanded, setExpanded] = useState(true)
  const [areas, setAreas] = useState<AreaFeature[]>([])
  useEffect(() => {
    loadAreas().then(setAreas)
  }, [])

  const options = useMemo(() => listAreaOptions(areas), [areas])

  function handlePick(value: string | null) {
    if (!value) return
    const feature = getArea(areas, value)
    if (feature) {
      addZone({
        name: feature.properties.name,
        source: 'area',
        areaId: value,
        geometry: feature.geometry,
      })
    }
  }

  return (
    <Stack gap={8}>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Switch
          label="Exclusion zones"
          size="sm"
          checked={exclusionsVisible}
          onChange={(e) => setExclusionsVisible(e.currentTarget.checked)}
        />
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          aria-label={expanded ? 'Collapse exclusion controls' : 'Expand exclusion controls'}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '▾' : '▸'}
        </ActionIcon>
      </Group>

      {expanded && (
        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            Areas you won&apos;t live in — cut from the Idealista search.
          </Text>

          <Group gap="xs" grow>
            <Button
              size="xs"
              variant={drawingMode === 'polygon' ? 'filled' : 'light'}
              color="dark"
              onClick={() => setDrawingMode(drawingMode === 'polygon' ? null : 'polygon')}
            >
              {drawingMode === 'polygon' ? 'Drawing… (Esc)' : 'Draw polygon'}
            </Button>
            <Button
              size="xs"
              variant={drawingMode === 'freehand' ? 'filled' : 'light'}
              color="dark"
              onClick={() => setDrawingMode(drawingMode === 'freehand' ? null : 'freehand')}
            >
              {drawingMode === 'freehand' ? 'Drawing… (Esc)' : 'Freehand'}
            </Button>
          </Group>

          <Select
            size="xs"
            placeholder="Add district / barri / municipality"
            searchable
            clearable
            data={options}
            value={null}
            onChange={handlePick}
            nothingFoundMessage="No match"
            comboboxProps={{ withinPortal: false }}
          />

          {zones.length > 0 && (
            <Stack gap={4}>
              {zones.map((z) => (
                <Group key={z.id} justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="xs" truncate>
                    {z.source === 'drawn' ? '✎ ' : '📍 '}
                    {z.name}
                  </Text>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    aria-label={`Remove ${z.name}`}
                    onClick={() => removeZone(z.id)}
                  >
                    ×
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  )
}
