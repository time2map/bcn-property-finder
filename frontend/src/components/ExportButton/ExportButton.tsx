import { Button, Loader, Stack, Text } from '@mantine/core'
import { useIdealistaAreas, useComputeIdealistaAreas } from '../../hooks/useIdealistaAreas'
import { useStore } from '../../store'
import { useEffectiveArea } from '../../hooks/useEffectiveArea'

interface ExportButtonProps {
  isLoading?: boolean
}

export function ExportButton({ isLoading = false }: ExportButtonProps) {
  const { urls, count } = useIdealistaAreas()
  const { compute, computing } = useComputeIdealistaAreas()
  const effectiveArea = useEffectiveArea()
  const hoveredAreaIndex = useStore((s) => s.hoveredAreaIndex)
  const setHoveredAreaIndex = useStore((s) => s.setHoveredAreaIndex)
  const zonesVisible = useStore((s) => s.idealistaZonesVisible)
  const setZonesVisible = useStore((s) => s.setIdealistaZonesVisible)

  const hasArea = effectiveArea !== null
  const busy = isLoading || computing

  // No isochrone yet and not loading — nothing to show.
  if (!hasArea && !isLoading) return null

  // No computed areas yet: show the "make zones" button.
  if (count === 0) {
    return (
      <Button
        fullWidth
        size="xs"
        disabled={busy}
        onClick={computing ? undefined : compute}
        leftSection={busy ? <Loader size={12} color="white" /> : '🏠'}
        style={{ backgroundColor: busy ? undefined : '#F06965' }}
      >
        {isLoading ? 'Building isochrone…' : computing ? 'Computing…' : 'Make zones for Idealista'}
      </Button>
    )
  }

  // Areas are computed — show links + visibility toggle.
  const areaLabel = (i: number) => (i === 0 ? 'Main Area' : `Area ${i + 1}/${count}`)

  if (count === 1) {
    return (
      <Stack gap={4}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text size="xs" fw={500} style={{ flex: 1 }}>Idealista — 1 area</Text>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            p={0}
            style={{ minWidth: 28, height: 22, fontSize: 14 }}
            onClick={() => setZonesVisible(!zonesVisible)}
            title={zonesVisible ? 'Hide zone on map' : 'Show zone on map'}
          >
            {zonesVisible ? '👁' : '🔇'}
          </Button>
        </div>
        <Button
          fullWidth
          size="xs"
          component="a"
          href={urls[0]}
          target="_blank"
          rel="noopener noreferrer"
          leftSection="🏠"
          style={{ backgroundColor: '#F06965' }}
        >
          {areaLabel(0)} ↗
        </Button>
      </Stack>
    )
  }

  return (
    <Stack gap={6}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Text size="xs" fw={500} style={{ flex: 1 }}>Idealista — {count} areas</Text>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          p={0}
          style={{ minWidth: 28, height: 22, fontSize: 14 }}
          onClick={() => setZonesVisible(!zonesVisible)}
          title={zonesVisible ? 'Hide zones on map' : 'Show zones on map'}
        >
          {zonesVisible ? '👁' : '🔇'}
        </Button>
      </div>
      <Text size="xs" c="dimmed">
        Idealista allows one simple area per search. Open each:
      </Text>
      {urls.map((url, i) => (
        <Button
          key={url}
          component="a"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          fullWidth
          size="xs"
          leftSection="🏠"
          variant={hoveredAreaIndex === i ? 'filled' : 'light'}
          color="red"
          onMouseEnter={() => setHoveredAreaIndex(i)}
          onMouseLeave={() => setHoveredAreaIndex(null)}
        >
          {areaLabel(i)} ↗
        </Button>
      ))}
    </Stack>
  )
}
