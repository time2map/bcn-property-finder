import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { FUNNEL_CONFIG } from '../services/funnel/funnelConfig'
import { loadFunnelData, type LoadedFunnel } from '../services/funnel/funnelData'
import { canCut, finalPick, runFunnel, type FunnelResult, type FunnelRun } from '../services/funnel/funnel'
import type { WishId } from '../services/funnel/funnelWishes'

export interface FunnelView {
  loaded: LoadedFunnel | null
  error: boolean
  run: FunnelRun | null
  /** Wishes not picked yet, and whether each can still narrow the buildings left. */
  offers: { wish: WishId; cuts: boolean }[]
  done: boolean
  result: FunnelResult | null
}

/** The funnel state of the store applied to the data (TODO-076): shared by the panel and the map layer. */
export function useFunnel(): FunnelView {
  const open = useStore((s) => s.funnelOpen)
  const picks = useStore((s) => s.funnelPicks)
  const sea = useStore((s) => s.funnelSea)
  const [loaded, setLoaded] = useState<LoadedFunnel | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || loaded) return
    let live = true
    loadFunnelData()
      .then((d) => { if (live) setLoaded(d) })
      .catch((err) => {
        console.error('Funnel data failed to load', err)
        if (live) setError(true)
      })
    return () => { live = false }
  }, [open, loaded])

  return useMemo(() => {
    if (!loaded) return { loaded, error, run: null, offers: [], done: false, result: null }
    const { fd } = loaded
    const run = runFunnel(fd, picks, sea, FUNNEL_CONFIG)
    const done = run.steps.length >= FUNNEL_CONFIG.steps || run.alive.length <= 1
    // A pick that no longer cuts (after the sea was switched on) stays picked: it is not offered again.
    const offers = done ? [] : fd.wishes
      .filter((w) => !picks.includes(w))
      .map((wish) => ({ wish, cuts: canCut(fd, run.alive, wish, run.steps.length, FUNNEL_CONFIG) }))
    const result = done ? finalPick(fd, run.alive, run.steps.map((s) => s.wish), FUNNEL_CONFIG) : null
    return { loaded, error, run, offers, done, result }
  }, [loaded, error, picks, sea])
}
