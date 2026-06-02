import { Notification, Loader } from '@mantine/core'
import { useScreenshotDrop } from '../../hooks/useScreenshotDrop'

interface Props {
  children: React.ReactNode
  onError: (msg: string) => void
}

const DRAG_LABELS: Record<string, string> = {
  image: 'Drop screenshot here',
  html: 'Drop Idealista page here',
}

export function ScreenshotDropZone({ children, onError }: Props) {
  const { state, handleDragOver, handleDragLeave, handleDrop, dismissBanner } =
    useScreenshotDrop(onError)

  const dragLabel = DRAG_LABELS[state.dragType ?? ''] ?? 'Drop file here'

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {state.isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(34, 139, 230, 0.18)',
            border: '3px dashed #228be6',
            borderRadius: 4,
            zIndex: 500,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '16px 28px',
              fontSize: 18,
              fontWeight: 600,
              color: '#228be6',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            {dragLabel}
          </div>
        </div>
      )}

      {state.isProcessing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.6)',
            zIndex: 500,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '16px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            <Loader size="sm" />
            <span style={{ fontSize: 16, fontWeight: 500 }}>{state.processingLabel}</span>
          </div>
        </div>
      )}

      {state.approxBanner && (
        <Notification
          color="yellow"
          title="Address is approximate"
          onClose={dismissBanner}
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 600,
            maxWidth: 380,
          }}
        >
          Idealista hides exact addresses — drag the pin to the correct location.
        </Notification>
      )}
    </div>
  )
}
