import { useTranslation } from 'react-i18next'
import { ADD_LABEL, type ConditionKey } from '../../services/conditionOptions'

/** "+ Quiet", "+ Within my budget": the conditions that are not on yet. */
export function AddConditionChips({ missing, onAdd }: { missing: readonly ConditionKey[]; onAdd: (key: ConditionKey) => void }) {
  const { t } = useTranslation('editor')
  if (missing.length === 0) return null
  return (
    <div className="add-chips">
      <span className="add-chips__label">{t('editor.add')}</span>
      {missing.map((k) => (
        <button key={k} type="button" className="add-chip" onClick={() => onAdd(k)}>
          {t('editor.chip', { label: ADD_LABEL[k] })}
        </button>
      ))}
    </div>
  )
}
