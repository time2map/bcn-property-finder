import { Checkbox, Stack, Switch } from '@mantine/core'
import { useStore } from '../../store'
import { LivabilityLegend } from '../LivabilityLayer/LivabilityLegend'

/**
 * "Livability" layer controls (feature 017).
 *
 * A single layer toggle with an optional "Consider noise" sub-option. The sub-options live in an
 * extensible `Stack` so future layers (per-hub accessibility — feature 018, other factors) slot in
 * as additional checkboxes under the same group.
 */
export function LivabilityControls() {
  const visible = useStore((s) => s.livabilityVisible)
  const setVisible = useStore((s) => s.setLivabilityVisible)
  const considerNoise = useStore((s) => s.livabilityConsiderNoise)
  const setConsiderNoise = useStore((s) => s.setLivabilityConsiderNoise)

  return (
    <Stack gap={8}>
      <Switch
        label="Livability"
        size="sm"
        checked={visible}
        onChange={(e) => setVisible(e.currentTarget.checked)}
      />
      {visible && (
        <Stack gap={6} pl={28}>
          <Checkbox
            label="Consider noise"
            size="xs"
            checked={considerNoise}
            onChange={(e) => setConsiderNoise(e.currentTarget.checked)}
          />
          <LivabilityLegend />
        </Stack>
      )}
    </Stack>
  )
}
