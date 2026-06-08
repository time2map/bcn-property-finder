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

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1)
  const [r2, g2, b2] = hexToRgb(c2)
  const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0')
  const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0')
  const b = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

/** Maps score to a color using the same remapped ramp as the composite layer on the map. */
function scoreColorForRange(score: number, min: number, max: number): string {
  const ramp = SCORE_RAMP
  if (max <= min) {
    // fallback: full 0-100 scale
    for (let i = ramp.length - 1; i >= 0; i--) {
      if (score >= ramp[i].stop) return ramp[i].color
    }
    return ramp[0].color
  }
  // Remap: min → ramp[0], max → ramp[last], same as buildScoreFillColorForRange
  const span = max - min
  const stops = ramp.map((s, i) => ({ val: min + span * (i / (ramp.length - 1)), color: s.color }))
  const t = Math.max(0, Math.min(1, (score - min) / span))
  const idx = t * (ramp.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(Math.ceil(idx), ramp.length - 1)
  if (lo === hi) return stops[lo].color
  return lerpColor(stops[lo].color, stops[hi].color, idx - lo)
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
  const scoreRange = useStore((s) => s.compositeScoreRange)

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
  const [sMin, sMax] = scoreRange
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
              <Text size="sm" fw={700} style={{ color: scoreColorForRange(score, sMin, sMax) }}>{score}</Text>
            </Group>
            <div style={{ height: 6, borderRadius: 3, background: '#eee', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${sMax > sMin ? ((score - sMin) / (sMax - sMin)) * 100 : score}%`,
                  background: scoreColorForRange(score, sMin, sMax),
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
