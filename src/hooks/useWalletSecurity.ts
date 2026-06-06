import { useEffect } from 'react'
import { getAutoLockMs, isSessionActive, isSessionExpired, lockSession, touchSession } from '../lib/secureSession'

export function useWalletSecurity(onAutoLock: () => void) {
  useEffect(() => {
    if (!isSessionActive()) return

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const
    const onActivity = () => touchSession()
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    const interval = window.setInterval(() => {
      if (isSessionExpired()) {
        lockSession()
        onAutoLock()
      }
    }, 30_000)

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        touchSession()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity))
      window.clearInterval(interval)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [onAutoLock])
}

export function formatAutoLockMinutes(): number {
  return Math.round(getAutoLockMs() / 60_000)
}
