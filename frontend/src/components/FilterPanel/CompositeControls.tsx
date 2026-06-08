import { useState } from 'react'
import { Checkbox, Group, Modal, RangeSlider, Slider, Stack, Switch, Text } from '@mantine/core'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS, type CompositeWeights } from '../../store'
import { LANDMARKS, ALL_LANDMARK_IDS } from '../../services/cityCore/landmarks'
import { CompositeLegend } from '../CompositeLayer/CompositeLegend'

const STEP = 25_000

function formatPrice(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`
  return `${Math.round(v / 1_000)}k€`
}

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
        padding: '0 2px', fontSize: 12, color: '#aaa', lineHeight: 1,
      }}
    >
      ⚙
    </button>
  )
}

interface ComponentRowProps {
  id: keyof CompositeWeights
  label: string
  weight: number
  onChange: (id: keyof CompositeWeights, value: number) => void
  onGear?: () => void
}

function ComponentRow({ id, label, weight, onChange, onGear }: ComponentRowProps) {
  const [lastWeight, setLastWeight] = useState(weight > 0 ? weight : DEFAULT_COMPOSITE_WEIGHTS[id])
  const enabled = weight > 0

  function toggle(checked: boolean) {
    if (checked) {
      onChange(id, lastWeight)
    } else {
      setLastWeight(weight)
      onChange(id, 0)
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
          onChange={(v) => onChange(id, v)}
          aria-label={`${label} weight`}
          style={{ '--slider-color': '#4CAF50' } as React.CSSProperties}
        />
      )}
    </Stack>
  )
}

export function CompositeControls() {
  const visible = useStore((s) => s.compositeVisible)
  const setVisible = useStore((s) => s.setCompositeVisible)
  const weights = useStore((s) => s.compositeWeights)
  const setWeights = useStore((s) => s.setCompositeWeights)
  const scoreRange = useStore((s) => s.compositeScoreRange)
  const setScoreRange = useStore((s) => s.setCompositeScoreRange)
  const priceRange = useStore((s) => s.idealistaPriceRange)
  const setRange = useStore((s) => s.setIdealistaPriceRange)
  const bounds = useStore((s) => s.idealistaPriceBounds)
  const enabledIds = useStore((s) => s.enabledLandmarkIds)
  const setEnabledIds = useStore((s) => s.setEnabledLandmarkIds)

  const [priceModalOpen, setPriceModalOpen] = useState(false)
  const [cityModalOpen, setCityModalOpen] = useState(false)

  const sliderMin = bounds ? Math.floor(bounds[0] / STEP) * STEP : 200_000
  const sliderMax = bounds ? Math.ceil(bounds[1] / STEP) * STEP : 600_000

  function setWeight(id: keyof CompositeWeights, value: number) {
    setWeights({ ...weights, [id]: value })
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
      <Modal
        opened={priceModalOpen}
        onClose={() => setPriceModalOpen(false)}
        title="Idealista Price range"
        size="sm"
      >
        <Stack gap={12} pb={8}>
          <Text size="xs" c="dimmed">
            {formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}
          </Text>
          <RangeSlider
            min={sliderMin}
            max={sliderMax}
            step={STEP}
            value={priceRange}
            onChange={(v) => setRange(v as [number, number])}
            label={formatPrice}
            minRange={STEP * 2}
            style={{ '--slider-color': '#9970ab' } as React.CSSProperties}
            styles={{ thumb: { borderColor: '#9970ab' } }}
          />
          <Text size="xs" c="dimmed" mt={8}>
            Score: cheapest (≤ min) → 100, most expensive (≥ max) → 0
          </Text>
        </Stack>
      </Modal>

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
        <Switch
          label="Composite Index"
          size="sm"
          checked={visible}
          onChange={(e) => setVisible(e.currentTarget.checked)}
        />
        {visible && (
          <Stack gap={10} pl={28}>
            <ComponentRow id="poiAccess" label="POI Access"
              weight={weights.poiAccess} onChange={setWeight} />
            <ComponentRow id="noise" label="Noise"
              weight={weights.noise} onChange={setWeight} />
            <ComponentRow id="cityCore" label="City Core Access"
              weight={weights.cityCore} onChange={setWeight}
              onGear={() => setCityModalOpen(true)} />
            <ComponentRow id="price" label="Idealista Price"
              weight={weights.price} onChange={setWeight}
              onGear={() => setPriceModalOpen(true)} />

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
                style={{ '--slider-color': '#4CAF50' } as React.CSSProperties}
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
