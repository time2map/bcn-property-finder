import { createContext, useContext } from 'react'

/** Places in the sheet that other components fill with a portal (the building card, TODO-062). */
export interface Slots { header: HTMLElement | null; body: HTMLElement | null }
export const SheetSlots = createContext<Slots>({ header: null, body: null })
export const useSheetSlots = (): Slots => useContext(SheetSlots)
