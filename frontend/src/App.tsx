import { useMediaQuery } from '@mantine/hooks'
import { Drawer, ActionIcon } from '@mantine/core'
import { useState } from 'react'
import { Map } from './components/Map/Map'
import { FilterPanel } from './components/FilterPanel/FilterPanel'
import { useUrlState } from './hooks/useUrlState'
import './index.css'

export function App() {
  useUrlState()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [drawerOpen, setDrawerOpen] = useState(false)

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
    </div>
  )
}

export default App
