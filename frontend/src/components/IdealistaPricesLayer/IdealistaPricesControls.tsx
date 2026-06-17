import { useEffect } from 'react'
import { Group, Stack, Switch, Text } from '@mantine/core'
import { useStore } from '../../store'
import { PriceWindowSlider } from './PriceWindowSlider'

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  return `€${Math.round(n / 1_000)}k`
}

const STEP = 10_000
const MIN_RANGE = 50_000

export function IdealistaPricesControls() {
  const visible = useStore((s) => s.idealistaPricesVisible)
  const setVisible = useStore((s) => s.setIdealistaPricesVisible)
  const priceRange = useStore((s) => s.idealistaPriceRange)
  const setRange = useStore((s) => s.setIdealistaPriceRange)
  const bounds = useStore((s) => s.idealistaPriceBounds)

  const boundsMin = bounds?.[0] ?? 100_000
  const boundsMax = bounds?.[1] ?? 2_000_000
  const [lo, hi] = priceRange

  useEffect(() => {
    if (bounds) setRange(bounds)
  }, [bounds]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Stack gap={8}>
      <Switch
        label="Idealista prices"
        size="sm"
        checked={visible}
        onChange={(e) => setVisible(e.currentTarget.checked)}
      />
      {visible && (
        <Stack gap={6}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Price window</Text>
            <Text size="xs" fw={500}>{formatPrice(lo)} – {formatPrice(hi)}</Text>
          </Group>
          <PriceWindowSlider
            min={boundsMin}
            max={boundsMax}
            lo={lo}
            hi={hi}
            step={STEP}
            minRange={MIN_RANGE}
            onChange={setRange}
          />
          <Group justify="space-between">
            <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(boundsMin)}</Text>
            <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(boundsMax)}</Text>
          </Group>
        </Stack>
      )}
    </Stack>
  )
}
