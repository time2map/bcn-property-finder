import { IconChevronRight } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { Profile } from '../../services/conditionOptions'
import { profileBlurb, profileName } from '../../services/presets'

/** The profiles of the first screen: a name and what it asks for. */
export function PresetCards({ presets, onPick }: { presets: readonly Profile[]; onPick: (p: Profile) => void }) {
  useTranslation() // render again when the language changes
  return (
    <div className="preset-cards">
      {presets.map((p) => (
        <button key={p.id} type="button" className="preset-card" onClick={() => onPick(p)}>
          <span className="preset-card__text">
            <b>{profileName(p)}</b>
            <span>{profileBlurb(p)}</span>
          </span>
          <IconChevronRight size={18} stroke={2} aria-hidden />
        </button>
      ))}
    </div>
  )
}
