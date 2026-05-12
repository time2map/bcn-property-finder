import { useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { Drawer, ActionIcon, Notification } from '@mantine/core'
import { Map } from './components/Map/Map'
import { FilterPanel } from './components/FilterPanel/FilterPanel'
import { useUrlState } from './hooks/useUrlState'
import { useIsochrone } from './hooks/useIsochrone'
import './index.css'

export function App() {
  useUrlState()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useIsochrone((err) => {
    setErrorMsg(err.message)
    setTimeout(() => setErrorMsg(null), 4000)
  })

  return (
    <div className="app">
      <Map />

      {isMobile ? (
        <>
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
            <FilterPanel />
          </Drawer>
        </>
      ) : (
        <div className="panel-desktop">
          <FilterPanel />
        </div>
      )}

      {errorMsg && (
        <Notification
          color="red"
          title="Could not update isochrone"
          onClose={() => setErrorMsg(null)}
          style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, maxWidth: 320 }}
        >
          {errorMsg}
        </Notification>
      )}
    </div>
  )
}

export default App
