import { useEffect, useMemo, useState } from 'react'
import { ActionIcon, Button, Group, Select, Stack, Text } from '@mantine/core'
import { useExclusionsStore } from '../../store/exclusionsStore'
import { getArea, listAreaOptions, loadAreas, type AreaFeature } from '../../services/areas'

/** Panel section for defining "no-go" exclusion zones (draw + add-by-area + active list). */
export function ExclusionControls() {
  const zones = useExclusionsStore((s) => s.zones)
  const drawingMode = useExclusionsStore((s) => s.drawingMode)
  const setDrawingMode = useExclusionsStore((s) => s.setDrawingMode)
  const addZone = useExclusionsStore((s) => s.addZone)
  const removeZone = useExclusionsStore((s) => s.removeZone)

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
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Exclusion zones
      </Text>
      <Text size="xs" c="dimmed">
        Areas you won&apos;t live in — cut from the Idealista search.
      </Text>

      <Group gap="xs" grow>
        <Button
          size="xs"
          variant={drawingMode === 'polygon' ? 'filled' : 'light'}
          color="red"
          onClick={() => setDrawingMode(drawingMode === 'polygon' ? null : 'polygon')}
        >
          {drawingMode === 'polygon' ? 'Drawing… (Esc)' : 'Draw polygon'}
        </Button>
        <Button
          size="xs"
          variant={drawingMode === 'freehand' ? 'filled' : 'light'}
          color="red"
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
                color="red"
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
  )
}
