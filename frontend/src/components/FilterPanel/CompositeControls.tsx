import { useState } from 'react'
import { ActionIcon, Checkbox, Group, Modal, RangeSlider, Slider, Stack, Switch, Text } from '@mantine/core'
import { IconSettings, IconInfoCircle } from '@tabler/icons-react'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS, type CompositeWeights } from '../../store'
import { LANDMARKS, ALL_LANDMARK_IDS } from '../../services/cityCore/landmarks'
import { DEFAULT_RISK_STRENGTHS, type RiskStrengths } from '../../services/climateRisk/climateRisk'
import { CompositeLegend } from '../CompositeLayer/CompositeLegend'

const SCORE_MARKS = [
  { value: 0, label: '0' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 75, label: '75' },
  { value: 100, label: '100' },
]

interface GearButtonProps {
  onClick: () => void
  label: string
}

function GearButton({ onClick, label }: GearButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0 2px', color: '#868e96', lineHeight: 0, display: 'inline-flex',
      }}
    >
      <IconSettings size={15} stroke={1.8} />
    </button>
  )
}

interface ComponentRowProps {
  label: string
  weight: number
  /** Value restored when the row is re-enabled and had no previous value. */
  defaultWeight: number
  onChange: (value: number) => void
  onGear?: () => void
  /** Noun used in the slider's accessible name, e.g. "weight" or "strength". */
  sliderNoun?: string
}

function ComponentRow({ label, weight, defaultWeight, onChange, onGear, sliderNoun = 'weight' }: ComponentRowProps) {
  const [lastWeight, setLastWeight] = useState(weight > 0 ? weight : defaultWeight)
  const enabled = weight > 0

  function toggle(checked: boolean) {
    if (checked) {
      onChange(lastWeight)
    } else {
      setLastWeight(weight)
      onChange(0)
    }
  }

  return (
    <Stack gap={4}>
      <Group gap={6} wrap="nowrap">
        <Checkbox
          size="xs"
          checked={enabled}
          onChange={(e) => toggle(e.currentTarget.checked)}
          aria-label={`Enable ${label}`}
        />
        <Text size="xs" style={{ flex: 1 }}>{label}</Text>
        {enabled && onGear && (
          <GearButton onClick={onGear} label={`Configure ${label}`} />
        )}
        {enabled && (
          <Text size="xs" c="dimmed" w={12} ta="right">{weight}</Text>
        )}
      </Group>
      {enabled && (
        <Slider
          min={1}
          max={10}
          step={1}
          size="xs"
          value={weight}
          onChange={(v) => onChange(v)}
          aria-label={`${label} ${sliderNoun}`}
          style={{ '--slider-color': '#F06965' } as React.CSSProperties}
        />
      )}
    </Stack>
  )
}

function InfoModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="About Livability Index" size="md">
      <Stack gap={12} pb={8}>
        <Text size="sm">
          The Livability Index is a weighted average of up to 5 components. Each component is
          normalised to 0–100 before combining. Adjust weights to reflect your priorities.
        </Text>

        <Stack gap={6}>
          <Text size="sm" fw={600}>Walkability</Text>
          <Text size="xs" c="dimmed">
            Scores how well-served a location is by 10 everyday services: supermarket, pharmacy,
            park, school, kindergarten, clinic, metro, café, restaurant, beach. For each category,
            an exponential distance-decay score is computed from the cell centroid
            (decay half-distance ~400 m, max radius 1 500 m). The final walkability is the weighted
            mean across all 10 categories, normalised to 0–100.
          </Text>
        </Stack>

        <Stack gap={6}>
          <Text size="sm" fw={600}>Noise</Text>
          <Text size="xs" c="dimmed">
            Based on Lden (day-evening-night equivalent level, dB) from Barcelona's 2022 strategic
            noise map. Formula: score = clamp((75 − Lden) / 30 × 100, 0, 100).
            Very quiet (≤ 45 dB) → 100 · WHO recommended (53 dB) → 73 · EU action level (55 dB) →
            67 · highly noisy (≥ 75 dB) → 0.
          </Text>
        </Stack>

        <Stack gap={6}>
          <Text size="sm" fw={600}>City Core Access</Text>
          <Text size="xs" c="dimmed">
            Average walking-minute score across your selected landmarks (Sagrada Família, Plaça
            Catalunya…). Per-landmark score: ≤ 15 min → 100, 30 min → 75, 45 min → 50,
            90 min → 25, &gt; 90 min → 0. Use the gear icon to pick which landmarks count.
          </Text>
        </Stack>

        <Stack gap={6}>
          <Text size="sm" fw={600}>Market Price (Generalitat)</Text>
          <Text size="xs" c="dimmed">
            Official average transaction price €/m² per neighbourhood (Generalitat de Catalunya
            open data). Normalised with dataset p5/p95 bounds — cheaper relative to the city
            distribution → higher score.
          </Text>
        </Stack>

        <Stack gap={6}>
          <Text size="sm" fw={600}>Risk penalties</Text>
          <Text size="xs" c="dimmed">
            Climate risks are not averaged in — they reduce the score of exposed cells only:
            score × (1 − strength/10 × risk). Safe cells keep their score; strength 10 on a cell
            fully in the highest-risk zone drives it to 0.
          </Text>
          <Text size="xs" c="dimmed">
            <b>Flood risk</b> — share of the cell inside official river flood zones (ACA): 10-year
            zone counts fully, 100-year 60%, 500-year 25%. River flooding only; flash flooding of
            streets during heavy rain is not included.
          </Text>
          <Text size="xs" c="dimmed">
            <b>Wildfire risk</b> — share of the cell inside the wildland–urban interface (Protecció
            Civil, zones around forests ≥ 5 ha) × the hazard of the nearest forest (Generalitat
            structural wildfire hazard map 2024, classes 1–10), fading with distance. A static
            hazard map, not a forecast; recent burned areas are not reflected.
          </Text>
        </Stack>

      </Stack>
    </Modal>
  )
}

export function CompositeControls() {
  const visible = useStore((s) => s.compositeVisible)
  const setVisible = useStore((s) => s.setCompositeVisible)
  const weights = useStore((s) => s.compositeWeights)
  const setWeights = useStore((s) => s.setCompositeWeights)
  const scoreRange = useStore((s) => s.compositeScoreRange)
  const setScoreRange = useStore((s) => s.setCompositeScoreRange)
  const enabledIds = useStore((s) => s.enabledLandmarkIds)
  const setEnabledIds = useStore((s) => s.setEnabledLandmarkIds)
  const riskStrengths = useStore((s) => s.compositeRiskStrengths)
  const setRiskStrengths = useStore((s) => s.setCompositeRiskStrengths)

  const [cityModalOpen, setCityModalOpen] = useState(false)
  const [infoModalOpen, setInfoModalOpen] = useState(false)

  function weightRow(id: keyof CompositeWeights) {
    return {
      weight: weights[id],
      defaultWeight: DEFAULT_COMPOSITE_WEIGHTS[id],
      onChange: (value: number) => setWeights({ ...weights, [id]: value }),
    }
  }

  function riskRow(id: keyof RiskStrengths) {
    return {
      weight: riskStrengths[id],
      defaultWeight: DEFAULT_RISK_STRENGTHS[id] || 5,
      onChange: (value: number) => setRiskStrengths({ ...riskStrengths, [id]: value }),
      sliderNoun: 'strength',
    }
  }

  function toggleLandmark(id: string, checked: boolean) {
    if (checked) {
      setEnabledIds([...enabledIds, id])
    } else {
      const next = enabledIds.filter((i) => i !== id)
      if (next.length > 0) setEnabledIds(next)
    }
  }

  return (
    <>
      <InfoModal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} />

      <Modal
        opened={cityModalOpen}
        onClose={() => setCityModalOpen(false)}
        title="City Core landmarks"
        size="sm"
      >
        <Stack gap={6} pb={8}>
          {LANDMARKS.map((lm) => (
            <Checkbox
              key={lm.id}
              label={lm.name}
              size="xs"
              checked={enabledIds.includes(lm.id)}
              onChange={(e) => toggleLandmark(lm.id, e.currentTarget.checked)}
            />
          ))}
          <Checkbox
            label="All landmarks"
            size="xs"
            checked={enabledIds.length === ALL_LANDMARK_IDS.length}
            indeterminate={enabledIds.length > 0 && enabledIds.length < ALL_LANDMARK_IDS.length}
            onChange={(e) =>
              setEnabledIds(e.currentTarget.checked ? ALL_LANDMARK_IDS : [ALL_LANDMARK_IDS[0]])
            }
            styles={{ root: { borderTop: '1px solid #eee', paddingTop: 6, marginTop: 4 } }}
          />
        </Stack>
      </Modal>

      <Stack gap={8}>
        <Group gap={4} wrap="nowrap" align="center">
          <Switch
            label="Livability Index"
            size="sm"
            checked={visible}
            onChange={(e) => setVisible(e.currentTarget.checked)}
            style={{ flex: 1 }}
          />
          <ActionIcon
            size={16}
            variant="subtle"
            color="gray"
            onClick={() => setInfoModalOpen(true)}
            aria-label="About Livability Index"
          >
            <IconInfoCircle size={16} stroke={1.8} />
          </ActionIcon>
        </Group>
        {visible && (
          <Stack gap={10} pl={28}>
            <ComponentRow label="Walkability" {...weightRow('poiAccess')} />
            <ComponentRow label="Noise" {...weightRow('noise')} />
            <ComponentRow label="City Core Access" {...weightRow('cityCore')}
              onGear={() => setCityModalOpen(true)} />
            <ComponentRow label="Market Price" {...weightRow('openPrice')} />

            <Text size="xs" c="dimmed" mt={2}>Risk penalties</Text>
            <ComponentRow label="Flood risk" {...riskRow('flood')} />
            <ComponentRow label="Wildfire risk" {...riskRow('fire')} />

            <Stack gap={4}>
              <Text size="xs" c="dimmed">Score range</Text>
              <RangeSlider
                min={0}
                max={100}
                step={5}
                size="xs"
                value={scoreRange}
                onChange={(v) => setScoreRange(v as [number, number])}
                marks={SCORE_MARKS}
                aria-label="Score range filter"
                style={{ '--slider-color': '#F06965' } as React.CSSProperties}
                styles={{ markLabel: { fontSize: 9, marginTop: 4 } }}
              />
            </Stack>

            <CompositeLegend scoreRange={scoreRange} />
            <Text size="xs" c="dimmed">Black outline = missing data</Text>
          </Stack>
        )}
      </Stack>
    </>
  )
}
