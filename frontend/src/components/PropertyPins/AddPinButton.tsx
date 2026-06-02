import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Tooltip, Menu } from '@mantine/core'
import { usePinsStore } from '../../store/pinsStore'
import { useScreenshotDrop } from '../../hooks/useScreenshotDrop'

interface Props {
  onError: (msg: string) => void
}

export function AddPinButton({ onError }: Props) {
  const { pins, isAddingPin, setIsAddingPin } = usePinsStore()
  const { processImageFile, processHtmlFile } = useScreenshotDrop(onError)
  const [panelH, setPanelH] = useState(40)
  const photoRef = useRef<HTMLInputElement>(null)
  const htmlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pins.length === 0) { setPanelH(40); return }
    const panel = document.querySelector('.compare-panel') as HTMLElement | null
    if (!panel) return
    const obs = new ResizeObserver(([entry]) => setPanelH(entry.contentRect.height))
    obs.observe(panel)
    return () => obs.disconnect()
  }, [pins.length])

  const bottom = pins.length > 0 ? panelH + 16 : 24

  const buttonStyle = {
    position: 'fixed' as const,
    bottom,
    right: 16,
    zIndex: 200,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    transition: 'bottom 0.18s ease',
  }

  if (isAddingPin) {
    return (
      <Tooltip label="Click on map to place pin (Esc to cancel)" position="left">
        <ActionIcon
          size="xl"
          radius="xl"
          variant="filled"
          color="blue"
          onClick={() => setIsAddingPin(false)}
          style={buttonStyle}
          aria-label="Add apartment pin"
        >
          ✕
        </ActionIcon>
      </Tooltip>
    )
  }

  return (
    <>
      <Menu position="top-end" offset={8} withinPortal={false}>
        <Menu.Target>
          <ActionIcon
            size="xl"
            radius="xl"
            variant="white"
            style={buttonStyle}
            aria-label="Add apartment pin"
            title="Add apartment pin"
          >
            +
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => setIsAddingPin(true)}>
            Place on map
          </Menu.Item>
          <Menu.Item onClick={() => photoRef.current?.click()}>
            Upload photo
          </Menu.Item>
          <Menu.Item onClick={() => htmlRef.current?.click()}>
            Import Idealista HTML
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) processImageFile(file)
          if (photoRef.current) photoRef.current.value = ''
        }}
      />
      <input
        ref={htmlRef}
        type="file"
        accept=".html,.htm"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) processHtmlFile(file)
          if (htmlRef.current) htmlRef.current.value = ''
        }}
      />
    </>
  )
}
