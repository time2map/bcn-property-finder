import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, Group, Slider, Stack, Text } from '@mantine/core'

/** How much a risk penalty strength 1–10 matters, in words (047). */
function importanceKey(weight: number) {
  if (weight <= 2) return 'strength.s1' as const
  if (weight <= 4) return 'strength.s2' as const
  if (weight <= 6) return 'strength.s3' as const
  if (weight <= 8) return 'strength.s4' as const
  return 'strength.s5' as const
}

interface StrengthRowProps {
  label: string
  weight: number
  /** Value restored when the row is re-enabled and had no previous value. */
  defaultWeight: number
  onChange: (value: number) => void
}

/** A risk penalty: on / off and how much it matters (036, 047). */
export function StrengthRow({ label, weight, defaultWeight, onChange }: StrengthRowProps) {
  const { t } = useTranslation('panel')
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
          className="ink-control strength-check"
          checked={enabled}
          onChange={(e) => toggle(e.currentTarget.checked)}
          aria-label={t('strength.enable', { label })}
        />
        <Text size="xs" style={{ flex: 1 }}>{label}</Text>
        {enabled && (
          <Text size="xs" c="dimmed" ta="right" data-testid={`importance-${label}`}>{t(importanceKey(weight))}</Text>
        )}
      </Group>
      {enabled && (
        <Slider
          min={1}
          max={10}
          step={1}
          size="xs"
          className="strength-slider"
          value={weight}
          onChange={(v) => onChange(v)}
          aria-label={t('strength.strength', { label })}
          style={{ '--slider-color': '#F06965' } as React.CSSProperties}
        />
      )}
    </Stack>
  )
}
