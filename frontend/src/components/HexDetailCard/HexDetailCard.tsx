import { useEffect } from 'react'
import { ActionIcon, Divider, Group, Paper, Stack, Text } from '@mantine/core'
import { useStore } from '../../store'
import {
  hexBundleMap,
  hexPriceMap,
  hexOpenPriceBounds,
} from '../../services/composite/compositeData'
import { computeComposite } from '../../services/composite/compositeScore'
import { LANDMARKS } from '../../services/cityCore/landmarks'
import { SCORE_RAMP } from '../CompositeLayer/scoreRamp'

function scoreColor(score: number): string {
  for (let i = SCORE_RAMP.length - 1; i >= 0; i--) {
    if (score >= SCORE_RAMP[i].stop) return SCORE_RAMP[i].color
  }
  return SCORE_RAMP[0].color
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{label}</Text>
      <Text size="xs" c={muted ? 'dimmed' : undefined} fw={muted ? undefined : 500} ta="right">
        {value}
      </Text>
    </Group>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
        {title}
      </Text>
      {children}
    </Stack>
  )
}

export function HexDetailCard() {
  const selectedHexH3 = useStore((s) => s.selectedHexH3)
  const setSelectedHexH3 = useStore((s) => s.setSelectedHexH3)
  const weights = useStore((s) => s.compositeWeights)
  const enabledLandmarkIds = useStore((s) => s.enabledLandmarkIds)
  const priceRange = useStore((s) => s.idealistaPriceRange)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedHexH3(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSelectedHexH3])

  if (!selectedHexH3) return null

  const bundle = hexBundleMap.get(selectedHexH3)
  if (!bundle) return null

  const medianPrice = hexPriceMap.get(selectedHexH3) ?? null
  const bounds = hexOpenPriceBounds ?? { p5: 0, p95: 0 }
  const { score, components } = computeComposite(
    { ...bundle, medianPrice },
    weights,
    enabledLandmarkIds,
    priceRange,
    bounds,
  )

  // Top-3 nearest enabled landmarks (lowest walking minutes)
  const cityCoreLandmarks = enabledLandmarkIds
    .map((id) => {
      const props = bundle.cityCoreProps as Record<string, number | null | string>
      const minutes = props[id] as number | null
      const landmark = LANDMARKS.find((l) => l.id === id)
      return { id, name: landmark?.name ?? id, minutes }
    })
    .filter((e): e is { id: string; name: string; minutes: number } => e.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, 3)

  const fmtNum = (n: number) =>
    new Intl.NumberFormat('en-ES', { maximumFractionDigits: 0 }).format(n)

  return (
    <div className="hex-detail-overlay">
      <Paper shadow="md" p="md" radius="md" w={256} style={{ maxHeight: 'calc(100vh - 96px)', overflowY: 'auto' }}>
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={600} size="sm">Hex Details</Text>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setSelectedHexH3(null)}
              aria-label="Close hex detail card"
            >
              ×
            </ActionIcon>
          </Group>

          {/* Composite score bar */}
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Composite score</Text>
              <Text size="sm" fw={700} style={{ color: scoreColor(score) }}>{score}</Text>
            </Group>
            <div style={{ height: 6, borderRadius: 3, background: '#eee', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${score}%`,
                  background: scoreColor(score),
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </Stack>

          <Divider />

          <Section title="POI Access">
            <Row label="Walkability score" value={`${components.poiAccess}`} />
          </Section>

          {weights.noise > 0 && (
            <>
              <Divider />
              <Section title="Noise">
                <Row
                  label="Score"
                  value={components.noise !== null ? `${components.noise}` : '—'}
                  muted={components.noise === null}
                />
                {bundle.lden !== null && (
                  <Row label="Lden" value={`${bundle.lden} dB`} />
                )}
              </Section>
            </>
          )}

          {weights.cityCore > 0 && (
            <>
              <Divider />
              <Section title="City Core Access">
                <Row label="Score" value={`${components.cityCore}`} />
                {cityCoreLandmarks.map((e) => (
                  <Row key={e.id} label={e.name} value={`${Math.round(e.minutes)} min`} />
                ))}
              </Section>
            </>
          )}

          {weights.openPrice > 0 && (
            <>
              <Divider />
              <Section title="INCASOL Price">
                {bundle.saleEurM2 !== null ? (
                  <>
                    <Row label="Sale price" value={`${fmtNum(bundle.saleEurM2)} €/m²`} />
                    <Row
                      label="Score"
                      value={components.openPrice !== null ? `${components.openPrice}` : '—'}
                      muted={components.openPrice === null}
                    />
                  </>
                ) : (
                  <Row label="Sale price" value="—" muted />
                )}
              </Section>
            </>
          )}

          {weights.price > 0 && (
            <>
              <Divider />
              <Section title="Idealista Price">
                {medianPrice !== null ? (
                  <>
                    <Row label="Median listing" value={`${fmtNum(medianPrice)} €`} />
                    <Row
                      label="Score"
                      value={components.price !== null ? `${components.price}` : '—'}
                      muted={components.price === null}
                    />
                  </>
                ) : (
                  <Row label="Median listing" value="—" muted />
                )}
              </Section>
            </>
          )}
        </Stack>
      </Paper>
    </div>
  )
}
