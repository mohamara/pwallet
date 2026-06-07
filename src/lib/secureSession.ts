import type { PublicAccount, SecretAccount } from './wallet'
import { deriveAccount, toPublicAccount, wipeSecretAccount } from './wallet'

const AUTO_LOCK_MS = 15 * 60 * 1000

let session: SecretAccount | null = null
let lastActivityAt = 0

export function unlockSession(mnemonic: string, passphrase = ''): PublicAccount {
  session = deriveAccount(mnemonic, 0, passphrase)
  lastActivityAt = Date.now()
  return toPublicAccount(session)
}

export function requireSession(): SecretAccount {
  if (!session) {
    throw new Error('کیف پول قفل است')
  }
  touchSession()
  return session
}

export function getPublicSession(): PublicAccount | null {
  return session ? toPublicAccount(session) : null
}

export function isSessionActive(): boolean {
  return session !== null
}

export function touchSession(): void {
  if (session) lastActivityAt = Date.now()
}

export function isSessionExpired(): boolean {
  if (!session) return false
  return Date.now() - lastActivityAt > AUTO_LOCK_MS
}

export function lockSession(): void {
  if (session) {
    wipeSecretAccount(session)
  }
  session = null
  lastActivityAt = 0
}

export function getAutoLockMs(): number {
  return AUTO_LOCK_MS
}

export function assertSecureContext(): void {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error(
      'برای امنیت، کیف پول فقط روی HTTPS یا localhost اجرا می‌شود',
    )
  }
}
