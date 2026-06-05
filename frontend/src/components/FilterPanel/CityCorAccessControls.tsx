import { Checkbox, Stack, Switch } from '@mantine/core'
import { useStore } from '../../store'
import { LANDMARKS, ALL_LANDMARK_IDS } from '../../services/cityCore/landmarks'
import { CityCorAccessLegend } from '../CityCorAccessLayer/CityCorAccessLegend'

export function CityCorAccessControls() {
  const visible = useStore((s) => s.cityCoreVisible)
  const setVisible = useStore((s) => s.setCityCoreVisible)
  const enabledIds = useStore((s) => s.enabledLandmarkIds)
  const setEnabledIds = useStore((s) => s.setEnabledLandmarkIds)

  function toggleLandmark(id: string, checked: boolean) {
    if (checked) {
      setEnabledIds([...enabledIds, id])
    } else {
      const next = enabledIds.filter((i) => i !== id)
      // Keep at least one landmark enabled
      if (next.length > 0) setEnabledIds(next)
    }
  }

  return (
    <Stack gap={8}>
      <Switch
        label="City Core Access"
        size="sm"
        checked={visible}
        onChange={(e) => setVisible(e.currentTarget.checked)}
      />
      {visible && (
        <Stack gap={4} pl={28}>
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
            indeterminate={
              enabledIds.length > 0 && enabledIds.length < ALL_LANDMARK_IDS.length
            }
            onChange={(e) =>
              setEnabledIds(e.currentTarget.checked ? ALL_LANDMARK_IDS : [ALL_LANDMARK_IDS[0]])
            }
            styles={{ root: { borderTop: '1px solid #eee', paddingTop: 4, marginTop: 2 } }}
          />
          <CityCorAccessLegend />
        </Stack>
      )}
    </Stack>
  )
}
