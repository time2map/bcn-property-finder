import { useEffect } from 'react'
import { scoreSettingsOf, useStore } from '../store'
import { settingsKey } from '../services/buildings/firstVisit'
import { loadAreaStart } from '../services/areas/areaStart'

/**
 * Colours the area view from area-start.json while the scores are on their way (TODO-058): only when nothing is
 * ranked yet and the settings are the ones the file was computed for (a first visit). The scoring replaces the
 * ranks a moment later.
 */
export function useStartAreaRanks(): void {
  useEffect(() => {
    let live = true
    void loadAreaStart().then((start) => {
      if (!live || !start) return
      const st = useStore.getState()
      if (st.areaRanks || st.contrastBoost) return
      if (settingsKey(scoreSettingsOf(st)) !== start.key) return
      st.setAreaRanks(start.ranks)
    })
    return () => { live = false }
  }, [])
}
