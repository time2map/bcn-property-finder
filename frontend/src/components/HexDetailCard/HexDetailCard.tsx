import { useEffect } from 'react'
import { ActionIcon, Divider, Group, Paper, Stack, Text } from '@mantine/core'
import { useStore } from '../../store'
import {
  hexBundleMap,
  hexOpenPriceBounds,
} from '../../services/composite/compositeData'
import { computeComposite } from '../../services/composite/compositeScore'
import { LANDMARKS } from '../../services/cityCore/landmarks'
import { SERVICE_CATEGORIES } from '../../services/walkability/serviceCategories'
import { SCORE_RAMP } from '../CompositeLayer/scoreRamp'
import { mostSevereFloodZone, type ClimateRiskProps } from '../../services/climateRisk/climateRisk'

const FLOOD_ZONE_LABEL = { t10: '10-year', t100: '100-year', t500: '500-year' } as const
const PENALTY_COLOR = '#d73027'

function floodText(climate: ClimateRiskProps): string {
  const z = mostSevereFloodZone(climate)
  if (!z) return 'Outside mapped river flood zones'
  return `${FLOOD_ZONE_LABEL[z.zone]} flood zone (${Math.round(z.share * 100)}% of cell)`
}

function fireText(climate: ClimateRiskProps): string {
  if (!climate.fire_wui) return 'Not in the wildland–urban interface'
  if (climate.fire_class == null || climate.fire_dist_m == null) {
    return 'Wildland–urban interface · no rated forest nearby'
  }
  return `Wildland–urban interface · hazard class ${climate.fire_class} forest at ~${climate.fire_dist_m} m`
}

function streetText(climate: ClimateRiskProps): string {
  const { street_t10: t10, street_t100: t100 } = climate
  if (t10 == null || t100 == null) return 'No street-flooding model outside Barcelona'
  if (t10 === 0 && t100 === 0) return 'No significant street flooding modelled'
  const pct = (v: number) => Math.round(v * 100)
  return `Effective flooded area: ${pct(t10)}% (10-year rain) · ${pct(t100)}% (100-year rain)`
}

const STREET_HINT = 'Matters most for ground-floor flats, basements and underground parking'

function RiskRow({ label, text, penalty, hint }: { label: string; text: string; penalty: number; hint?: string }) {
  return (
    <Stack gap={0}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={500}>{label}</Text>
        {penalty > 0 && (
          <Text size="xs" fw={600} style={{ color: PENALTY_COLOR }}>−{penalty} pts</Text>
        )}
      </Group>
      <Text size="xs" c="dimmed">{text}</Text>
      {hint && penalty > 0 && (
        <Text size="xs" c="dimmed" fs="italic" style={{ fontSize: 10 }}>{hint}</Text>
      )}
    </Stack>
  )
}

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

/** Color for composite score — remapped to current score range, matching the map. */
function scoreColorForRange(score: number, min: number, max: number): string {
  const ramp = SCORE_RAMP
  if (max <= min) return scoreColor(score)
  const span = max - min
  const stops = ramp.map((s, i) => ({ color: s.color, val: min + span * (i / (ramp.length - 1)) }))
  const t = Math.max(0, Math.min(1, (score - min) / span))
  const idx = t * (ramp.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(Math.ceil(idx), ramp.length - 1)
  if (lo === hi) return stops[lo].color
  return lerpColor(stops[lo].color, stops[hi].color, idx - lo)
}

/** Color for sub-scores — always full 0–100 scale. */
function scoreColor(score: number): string {
  for (let i = SCORE_RAMP.length - 1; i >= 0; i--) {
    if (score >= SCORE_RAMP[i].stop) return SCORE_RAMP[i].color
  }
  return SCORE_RAMP[0].color
}

function ScoreBar({ score, color }: { score: number | null; color: string }) {
  return (
    <Group gap={8} align="center" wrap="nowrap">
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#eee', overflow: 'hidden', minWidth: 50 }}>
        {score !== null && (
          <div style={{ height: '100%', width: `${score}%`, background: color }} />
        )}
      </div>
      <Text size="xs" fw={600} style={{ color: score !== null ? color : '#aaa', minWidth: 48, textAlign: 'right' }}>
        {score !== null ? `${score} / 100` : '— / 100'}
      </Text>
    </Group>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
      {children}
    </Text>
  )
}

function LandmarkRow({ name, minutes }: { name: string; minutes: number }) {
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed" style={{ flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </Text>
      <Text size="xs" fw={500} style={{ flexShrink: 0 }}>{Math.round(minutes)} min</Text>
    </Group>
  )
}

/** Small colour-coded label for noise level relative to reference thresholds. */
function NoiseLabel({ lden }: { lden: number }) {
  let label: string
  let color: string
  if (lden < 45) { label = 'very quiet'; color = '#1a9850' }
  else if (lden < 53) { label = 'quiet'; color = '#91cf60' }
  else if (lden < 55) { label = 'near WHO limit (53 dB)'; color = '#fee08b' }
  else if (lden < 65) { label = 'above EU action level (55 dB)'; color = '#fc8d59' }
  else { label = 'highly noisy'; color = '#d73027' }
  return <Text size="xs" style={{ color }}>{label}</Text>
}

export function HexDetailCard() {
  const selectedHexH3 = useStore((s) => s.selectedHexH3)
  const setSelectedHexH3 = useStore((s) => s.setSelectedHexH3)
  const weights = useStore((s) => s.compositeWeights)
  const enabledLandmarkIds = useStore((s) => s.enabledLandmarkIds)
  const scoreRange = useStore((s) => s.compositeScoreRange)
  const riskStrengths = useStore((s) => s.compositeRiskStrengths)

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

  const bounds = hexOpenPriceBounds ?? { p5: 0, p95: 0 }
  const [sMin, sMax] = scoreRange
  const { score, baseScore, components, penalties } = computeComposite(
    bundle,
    weights,
    enabledLandmarkIds,
    bounds,
    riskStrengths,
  )
  const climate = bundle.climate ?? {}
  const riskShown = riskStrengths.flood > 0 || riskStrengths.fire > 0 || riskStrengths.street > 0
  const riskLost = penalties.flood + penalties.fire + penalties.street

  // All enabled landmarks sorted nearest first
  const cityCoreLandmarks = enabledLandmarkIds
    .map((id) => {
      const props = bundle.cityCoreProps as unknown as Record<string, number | null | string>
      const minutes = props[id] as number | null
      const landmark = LANDMARKS.find((l) => l.id === id)
      return { id, name: landmark?.name ?? id, minutes }
    })
    .filter((e): e is { id: string; name: string; minutes: number } => e.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes)

  const compositeColor = scoreColorForRange(score, sMin, sMax)
  const barPct = sMax > sMin ? Math.max(0, Math.min(100, ((score - sMin) / (sMax - sMin)) * 100)) : score

  const fmtNum = (n: number) =>
    new Intl.NumberFormat('en-ES', { maximumFractionDigits: 0 }).format(n)

  return (
    <div className="hex-detail-overlay">
      <Paper shadow="md" p="md" radius="md" w={264} style={{ maxHeight: 'calc(100vh - 96px)', overflowY: 'auto' }}>
        <Stack gap="sm">

          {/* Livability — main focus */}
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Livability</Text>
              <Text fw={800} lh={1} style={{ fontSize: 28, color: compositeColor }}>
                {score}
                <Text component="span" size="sm" c="dimmed" fw={400}> / 100</Text>
              </Text>
              {riskLost > 0 && (
                <Text size="xs" c="dimmed">{baseScore} before risk penalties</Text>
              )}
            </Stack>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setSelectedHexH3(null)}
              aria-label="Close hex detail card"
              mt={2}
            >
              ×
            </ActionIcon>
          </Group>
          <div style={{ height: 8, borderRadius: 4, background: '#eee', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${barPct}%`,
                background: compositeColor,
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <Divider />

          {/* Walkability */}
          <Stack gap={4}>
            <SectionTitle>Walkability</SectionTitle>
            <ScoreBar score={components.poiAccess} color={scoreColor(components.poiAccess)} />
            {bundle.walkCategories && (
              <Stack gap={3} mt={2}>
                {SERVICE_CATEGORIES.map((cat) => {
                  const catScore = bundle.walkCategories![cat.id]
                  if (catScore === undefined) return null
                  return (
                    <Group key={cat.id} gap={4} wrap="nowrap" align="center">
                      <Text style={{ fontSize: 11, width: 16, lineHeight: 1 }}>{cat.emoji}</Text>
                      <Text size="xs" c="dimmed" style={{ flex: 1, fontSize: 10 }}>{cat.label}</Text>
                      <div style={{ width: 48, height: 3, borderRadius: 2, background: '#eee', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${catScore}%`, background: scoreColor(catScore) }} />
                      </div>
                      <Text style={{ fontSize: 10, fontWeight: 600, minWidth: 20, textAlign: 'right', color: scoreColor(catScore) }}>
                        {catScore}
                      </Text>
                    </Group>
                  )
                })}
              </Stack>
            )}
          </Stack>

          {/* Noise */}
          {weights.noise > 0 && (
            <>
              <Divider />
              <Stack gap={4}>
                <SectionTitle>Noise</SectionTitle>
                <ScoreBar
                  score={components.noise}
                  color={components.noise !== null ? scoreColor(components.noise) : '#aaa'}
                />
                {bundle.lden !== null && (
                  <Group gap={6} align="center">
                    <Text size="xs" c="dimmed">Lden {bundle.lden} dB</Text>
                    <NoiseLabel lden={bundle.lden} />
                  </Group>
                )}
                <Text size="xs" c="dimmed" style={{ fontSize: 10, opacity: 0.7 }}>
                  WHO: &lt; 53 dB · EU action: 55 dB · harmful: ≥ 65 dB
                </Text>
              </Stack>
            </>
          )}

          {/* City Core */}
          {weights.cityCore > 0 && (
            <>
              <Divider />
              <Stack gap={4}>
                <SectionTitle>City Core Access</SectionTitle>
                <ScoreBar score={components.cityCore} color={scoreColor(components.cityCore)} />
                {cityCoreLandmarks.map((e) => (
                  <LandmarkRow key={e.id} name={e.name} minutes={e.minutes} />
                ))}
              </Stack>
            </>
          )}

          {/* Sale price (Generalitat official data) */}
          {weights.openPrice > 0 && (
            <>
              <Divider />
              <Stack gap={4}>
                <SectionTitle>Sale price</SectionTitle>
                {bundle.saleEurM2 !== null ? (
                  <>
                    <Text size="sm" fw={700}>
                      {fmtNum(bundle.saleEurM2)} €/m²
                    </Text>
                    <Text size="xs" c="dimmed">
                      Avg. transaction price, Generalitat official data
                    </Text>
                    <ScoreBar
                      score={components.openPrice}
                      color={components.openPrice !== null ? scoreColor(components.openPrice) : '#aaa'}
                    />
                  </>
                ) : (
                  <Text size="xs" c="dimmed">No data for this area</Text>
                )}
              </Stack>
            </>
          )}

          {/* Climate risk penalties — 036, 037 */}
          {riskShown && (
            <>
              <Divider />
              <Stack gap={6}>
                <SectionTitle>Climate risk</SectionTitle>
                {riskStrengths.flood > 0 && (
                  <RiskRow label="River flooding" text={floodText(climate)} penalty={penalties.flood} />
                )}
                {riskStrengths.fire > 0 && (
                  <RiskRow label="Wildfire" text={fireText(climate)} penalty={penalties.fire} />
                )}
                {riskStrengths.street > 0 && (
                  <RiskRow label="Street flooding" text={streetText(climate)} penalty={penalties.street}
                    hint={STREET_HINT} />
                )}
              </Stack>
            </>
          )}


        </Stack>
      </Paper>
    </div>
  )
}
