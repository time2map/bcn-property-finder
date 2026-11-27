import { useAboutStore } from '../../store/aboutStore'
import { MapCredit } from '../About/MapCredit'
import { IconInfoCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { LocateButton } from './LocateButton'
import { MobileLegend } from './MobileLegend'

/** Above the sheet, on the left the credit and, below it, the colour scale, on the right "About" and "Where am I" (TODO-062). */
export function MapOverlay() {
  const { t } = useTranslation('panel')
  const setAboutOpen = useAboutStore((s) => s.setOpen)
  return (
    <div className="mobile-map-overlay">
      <div className="mobile-map-overlay__left">
        <MapCredit compact />
        <MobileLegend />
      </div>
      <div className="mobile-map-buttons">
        <button type="button" className="round-button" aria-label={t('mobile.aboutThis')} onClick={() => setAboutOpen(true)}>
          <IconInfoCircle size={22} stroke={1.8} />
        </button>
        <LocateButton />
      </div>
    </div>
  )
}
