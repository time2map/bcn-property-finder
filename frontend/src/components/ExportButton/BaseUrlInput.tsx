import { useState } from 'react'
import { ActionIcon, Text, TextInput } from '@mantine/core'
import { useIdealistaBaseUrlStore } from '../../store/idealistaBaseUrlStore'
import { parseIdealistaBaseUrl } from '../../services/idealista'

type Status = 'idle' | 'saved' | 'invalid'

export function BaseUrlInput() {
  const { baseUrl, setBaseUrl, clearBaseUrl } = useIdealistaBaseUrlStore()
  const [inputValue, setInputValue] = useState(baseUrl ?? '')
  const [status, setStatus] = useState<Status>('idle')

  function commit(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      clearBaseUrl()
      setStatus('idle')
      return
    }
    const parsed = parseIdealistaBaseUrl(trimmed)
    if (parsed) {
      setBaseUrl(parsed)
      setInputValue(parsed)
      setStatus('saved')
    } else {
      setStatus('invalid')
    }
  }

  return (
    <div>
      <TextInput
        size="xs"
        placeholder="Paste Idealista URL with your filters…"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.currentTarget.value)
          setStatus('idle')
        }}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget.value) }}
        rightSection={
          baseUrl ? (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              title="Clear saved filters"
              onClick={() => {
                clearBaseUrl()
                setInputValue('')
                setStatus('idle')
              }}
            >
              ×
            </ActionIcon>
          ) : undefined
        }
      />
      {status === 'saved' && <Text size="xs" c="green">Filters saved</Text>}
      {status === 'invalid' && <Text size="xs" c="red">Invalid URL</Text>}
    </div>
  )
}
