import { useEffect, useState } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { usePinsStore } from '../../store/pinsStore'

export function AddPinButton() {
  const { pins, isAddingPin, setIsAddingPin } = usePinsStore()
  const [panelH, setPanelH] = useState(40)

  useEffect(() => {
    if (pins.length === 0) { setPanelH(40); return }
    const panel = document.querySelector('.compare-panel') as HTMLElement | null
    if (!panel) return
    const obs = new ResizeObserver(([entry]) => setPanelH(entry.contentRect.height))
    obs.observe(panel)
    return () => obs.disconnect()
  }, [pins.length])

  const bottom = pins.length > 0 ? panelH + 16 : 24

  return (
    <Tooltip
      label={isAddingPin ? 'Click on map to place pin (Esc to cancel)' : 'Add apartment pin'}
      position="left"
    >
      <ActionIcon
        size="xl"
        radius="xl"
        variant={isAddingPin ? 'filled' : 'white'}
        color={isAddingPin ? 'blue' : undefined}
        onClick={() => setIsAddingPin(!isAddingPin)}
        style={{
          position: 'fixed',
          bottom,
          right: 16,
          zIndex: 200,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'bottom 0.18s ease',
        }}
        aria-label="Add apartment pin"
      >
        {isAddingPin ? '✕' : '+'}
      </ActionIcon>
    </Tooltip>
  )
}
