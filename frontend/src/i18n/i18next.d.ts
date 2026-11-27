import 'i18next'
import type common from '../locales/en/common.json'
import type conditions from '../locales/en/conditions.json'
import type editor from '../locales/en/editor.json'
import type card from '../locales/en/card.json'
import type panel from '../locales/en/panel.json'
import type info from '../locales/en/info.json'
import type legal from '../locales/en/legal.json'
import type funnel from '../locales/en/funnel.json'

// The English files are the source of truth: a key that is not in them is a type error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    returnNull: false
    resources: { common: typeof common; conditions: typeof conditions; editor: typeof editor; card: typeof card; panel: typeof panel; info: typeof info; legal: typeof legal; funnel: typeof funnel }
  }
}
