import { createContext } from 'react'

/** One open word picker per panel (TODO-072): the editor owns which one, a word asks to open or close itself. */
export interface PickerHost {
  openId: string | null
  setOpenId: (id: string | null) => void
}
export const PickerHostContext = createContext<PickerHost | null>(null)

/** The place under a sentence where its picker opens in place; null before it is mounted or outside an editor. */
export const PickerSlotContext = createContext<HTMLElement | null>(null)
