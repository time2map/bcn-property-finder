import { lazy, Suspense, useEffect, useState } from 'react'
import { loadNamespace } from './i18n'
import { useMediaQuery } from '@mantine/hooks'
import { Notification, SegmentedControl } from '@mantine/core'
import { BrandBar } from './components/BrandBar/BrandBar'
import { FilterPanel } from './components/FilterPanel/FilterPanel'
import { OnboardingPanel } from './components/Onboarding/OnboardingPanel'
import { useStore } from './store'
import { SearchBox } from './components/SearchBox/SearchBox'
import { ComparePane } from './components/PropertyPins/ComparePane'
import { AddPinButton } from './components/PropertyPins/AddPinButton'
import { ScreenshotDropZone } from './components/PropertyPins/ScreenshotDropZone'
import { BuildingCard } from './components/BuildingCard/BuildingCard'
import { MobileSheet } from './components/MobileSheet/MobileSheet'
import { ConditionsSheetHeader } from './components/MobileSheet/ConditionsSheetHeader'
import { MobileTopBar } from './components/MobileTop/MobileTopBar'
import { useAboutStore } from './store/aboutStore'
import { MapCredit } from './components/About/MapCredit'
import { MapOverlay } from './components/MobileMap/MapOverlay'
import { useLinkedArea } from './hooks/useLinkedArea'
import { useLinkedBuilding } from './hooks/useLinkedBuilding'
import { useSheetFlow } from './hooks/useSheetFlow'
import { useSheetMapPadding } from './hooks/useSheetMapPadding'
import { useVisualViewportVar } from './hooks/useVisualViewport'
import { PHONE_QUERY } from './services/phoneConfig'
import { usePinsStore } from './store/pinsStore'
import { useUrlState } from './hooks/useUrlState'
import { useIsochrone } from './hooks/useIsochrone'
import { usePinAnalytics } from './hooks/usePinAnalytics'
import { features } from './features'
import { afterFirstPaint } from './services/firstPaint'
import './index.css'

// MapLibre is more than half of the JavaScript of the page. It is downloaded from the start (index.html preloads it)
// but runs after the first paint, so the panel shows up without waiting for it (TODO-058).
const LazyMap = lazy(() => import('./components/Map/Map').then((m) => ({ default: m.Map })))
// The area card (with the texts of the 73 barris) is only needed after a click on an area (TODO-064, 058).
const AreaCard = lazy(() => import('./components/AreaCard/AreaCard').then((m) => ({ default: m.AreaCard })))
const mapPlaceholder = <div style={{ width: '100%', height: '100%' }} />

/**
 * The map, started after the first paint. Its code and style are ready at once (both are preloaded), and setting
 * up the base map is a long task: started any earlier it would hold back the first paint.
 */
function Map() {
  const [painted, setPainted] = useState(false)
  useEffect(() => {
    let live = true
    void afterFirstPaint().then(() => { if (live) setPainted(true) })
    return () => { live = false }
  }, [])
  if (!painted) return mapPlaceholder
  return <Suspense fallback={mapPlaceholder}><LazyMap /></Suspense>
}

// The dialog is only needed after a click: it stays out of the first download (bundle budget, TODO-058).
// The funnel prototype (TODO-076) is behind a flag and `?funnel`: its code is fetched only when it opens.
const FunnelPanel = lazy(() => Promise.all([import('./components/Funnel/FunnelPanel'), loadNamespace('funnel')])
  .then(([m]) => ({ default: m.FunnelPanel })))
const AboutDialog = lazy(() => import('./components/About/AboutDialog').then((m) => ({ default: m.AboutDialog })))

export function App() {
  useLinkedArea()
  useLinkedBuilding() // before useUrlState rewrites the address and drops `b`
  useUrlState()
  usePinAnalytics()
  // Read at once, not after the first render: a phone must never start with the desktop layout.
  const isMobile = useMediaQuery(PHONE_QUERY, false, { getInitialValueInEffect: false })
  const aboutOpen = useAboutStore((s) => s.open)
  const [aboutEver, setAboutEver] = useState(false)
  useEffect(() => { if (aboutOpen) setAboutEver(true) }, [aboutOpen])
  const buildingOpen = useStore((s) => s.selectedBuilding !== null || s.selectedArea !== null)
  const [mobileView, setMobileView] = useState<'map' | 'compare'>('map')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pinCount = usePinsStore((s) => s.pins.length)
  const onboardingOpen = useStore((s) => s.onboardingOpen)
  const funnelOpen = useStore((s) => s.funnelOpen && !isMobile)
  const sheetOn = isMobile && !onboardingOpen
  useSheetFlow(sheetOn)
  useSheetMapPadding(sheetOn)
  useVisualViewportVar(isMobile)

  useIsochrone((err) => {
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
      {features.screenshot ? (
        <ScreenshotDropZone onError={showError}>
          <Map />
        </ScreenshotDropZone>
      ) : (
        <Map />
      )}
      {!isMobile && (
        <div className={features.onboarding ? 'top-panel top-panel--wide' : 'top-panel'}>
          <BrandBar />
          <SearchBox />
          {funnelOpen ? <Suspense fallback={null}><FunnelPanel /></Suspense> : onboardingOpen ? <OnboardingPanel /> : <FilterPanel />}
        </div>
      )}
      {!isMobile && <MapCredit className="map-credit--desktop" />}
      {!isMobile && <BuildingCard />}
      {!isMobile && <Suspense fallback={null}><AreaCard /></Suspense>}
      {aboutEver && <Suspense fallback={null}><AboutDialog /></Suspense>}
    </div>
  )

  if (isMobile) {
    return (
      <div className="app">
        {mapPane}

        {onboardingOpen ? (
          <div className="brand-mobile">
            <BrandBar />
            <SearchBox />
          </div>
        ) : (
          <MobileTopBar />
        )}

        {features.pins && mobileView === 'compare' && pinCount > 0 && (
          <div className="mobile-compare">
            <ComparePane fullScreen />
          </div>
        )}

        {onboardingOpen && (
          <div className="onboarding-sheet">
            <OnboardingPanel />
            <MapCredit compact className="map-credit--sheet" />
          </div>
        )}

        {!onboardingOpen && (
          <MobileSheet
            view={buildingOpen ? 'building' : 'main'}
            header={<ConditionsSheetHeader />}
            main={<FilterPanel embedded />}
            floating={<MapOverlay />}
          >
            <BuildingCard embedded />
            <Suspense fallback={null}><AreaCard embedded /></Suspense>
          </MobileSheet>
        )}

        {features.pins && pinCount > 0 && (
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

        {features.pins && mobileView === 'map' && <AddPinButton onError={showError} />}

        {errorNotification}
      </div>
    )
  }

  return (
    <div className="app">
      {features.pins ? (
        <div className="app-split">
          <ComparePane />
          {mapPane}
        </div>
      ) : mapPane}
      {features.pins && <AddPinButton onError={showError} />}
      {errorNotification}
    </div>
  )
}

export default App
