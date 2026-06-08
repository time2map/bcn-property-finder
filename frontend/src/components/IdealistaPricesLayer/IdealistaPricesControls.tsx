import { Stack, Switch } from '@mantine/core'
import { useStore } from '../../store'

export function IdealistaPricesControls() {
  const visible = useStore((s) => s.idealistaPricesVisible)
  const setVisible = useStore((s) => s.setIdealistaPricesVisible)

  return (
    <Stack gap={8}>
      <Switch
        label="Idealista prices"
        size="sm"
        checked={visible}
        onChange={(e) => setVisible(e.currentTarget.checked)}
      />
    </Stack>
  )
}
