import { useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { Drawer, ActionIcon, Notification, SegmentedControl } from '@mantine/core'
import { Map } from './components/Map/Map'
import { FilterPanel } from './components/FilterPanel/FilterPanel'
import { ComparePane } from './components/PropertyPins/ComparePane'
import { AddPinButton } from './components/PropertyPins/AddPinButton'
import { ScreenshotDropZone } from './components/PropertyPins/ScreenshotDropZone'
import { HexDetailCard } from './components/HexDetailCard/HexDetailCard'
import { usePinsStore } from './store/pinsStore'
import { useUrlState } from './hooks/useUrlState'
import { useIsochrone } from './hooks/useIsochrone'
import { usePinAnalytics } from './hooks/usePinAnalytics'
import './index.css'

export function App() {
  useUrlState()
  usePinAnalytics()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'map' | 'compare'>('map')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pinCount = usePinsStore((s) => s.pins.length)

  const { isLoading } = useIsochrone((err) => {
    setErrorMsg(err.message)
    setTimeout(() => setErrorMsg(null), 4000)
  })

  const showError = (msg: string) => {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 4000)
  }

  const errorNotification = errorMsg && (
    <Notification
      color="red"
      title="Could not update isochrone"
      onClose={() => setErrorMsg(null)}
      style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, maxWidth: 320 }}
    >
      {errorMsg}
    </Notification>
  )

  const mapPane = (
    <div className="map-pane">
      <ScreenshotDropZone onError={showError}>
        <Map />
      </ScreenshotDropZone>
      {!isMobile && (
        <div className="panel-desktop">
          <FilterPanel isLoading={isLoading} />
        </div>
      )}
      <HexDetailCard />
    </div>
  )

  if (isMobile) {
    return (
      <div className="app">
        {mapPane}

        {mobileView === 'compare' && pinCount > 0 && (
          <div className="mobile-compare">
            <ComparePane fullScreen />
          </div>
        )}

        <ActionIcon
          className="filter-toggle"
          size="xl"
          radius="xl"
          variant="white"
          onClick={() => setDrawerOpen(true)}
        >
          ⚙
        </ActionIcon>
        <Drawer
          opened={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          position="bottom"
          size="auto"
          title="Filters"
        >
          <FilterPanel isLoading={isLoading} />
        </Drawer>

        {pinCount > 0 && (
          <SegmentedControl
            className="mobile-view-toggle"
            value={mobileView}
            onChange={(v) => setMobileView(v as 'map' | 'compare')}
            data={[
              { label: 'Map', value: 'map' },
              { label: `Compare (${pinCount})`, value: 'compare' },
            ]}
          />
        )}

        {mobileView === 'map' && <AddPinButton onError={showError} />}

        {errorNotification}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="app-split">
        <ComparePane />
        {mapPane}
      </div>
      <AddPinButton onError={showError} />
      {errorNotification}
    </div>
  )
}

export default App
