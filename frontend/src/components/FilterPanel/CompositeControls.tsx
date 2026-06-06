import { useState } from 'react'
import { Checkbox, Group, RangeSlider, Slider, Stack, Switch, Text } from '@mantine/core'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS, type CompositeWeights } from '../../store'
import { CompositeLegend } from '../CompositeLayer/CompositeLegend'

const COMPONENTS: { id: keyof CompositeWeights; label: string }[] = [
  { id: 'poiAccess', label: 'POI Access' },
  { id: 'noise', label: 'Noise' },
  { id: 'cityCore', label: 'City Core Access' },
  { id: 'price', label: 'Idealista Price' },
]

const SCORE_MARKS = [
  { value: 0, label: '0' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 75, label: '75' },
  { value: 100, label: '100' },
]

interface ComponentRowProps {
  id: keyof CompositeWeights
  label: string
  weight: number
  onChange: (id: keyof CompositeWeights, value: number) => void
}

function ComponentRow({ id, label, weight, onChange }: ComponentRowProps) {
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
      <Group gap={8} wrap="nowrap">
        <Checkbox
          size="xs"
          checked={enabled}
          onChange={(e) => toggle(e.currentTarget.checked)}
          aria-label={`Enable ${label}`}
        />
        <Text size="xs" style={{ flex: 1 }}>{label}</Text>
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
  const priceRange = useStore((s) => s.idealistaPriceRange)
  const scoreRange = useStore((s) => s.compositeScoreRange)
  const setScoreRange = useStore((s) => s.setCompositeScoreRange)

  function setWeight(id: keyof CompositeWeights, value: number) {
    setWeights({ ...weights, [id]: value })
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

  return (
    <Stack gap={8}>
      <Switch
        label="Composite Index"
        size="sm"
        checked={visible}
        onChange={(e) => setVisible(e.currentTarget.checked)}
      />
      {visible && (
        <Stack gap={10} pl={28}>
          {COMPONENTS.map(({ id, label }) => (
            <ComponentRow
              key={id}
              id={id}
              label={label}
              weight={weights[id]}
              onChange={setWeight}
            />
          ))}

          {weights.price > 0 && (
            <Text size="xs" c="dimmed">
              Price score: {fmt(priceRange[0])} – {fmt(priceRange[1])}
            </Text>
          )}

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
  )
}
