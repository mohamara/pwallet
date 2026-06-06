import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ChainConfig } from '../lib/chains'
import { CHAINS } from '../lib/chains'
import {
  assertSecureContext,
  lockSession,
  unlockSession,
} from '../lib/secureSession'
import type { PublicAccount } from '../lib/wallet'

interface WalletContextValue {
  account: PublicAccount | null
  selectedChain: ChainConfig
  unlock: (mnemonic: string) => void
  lock: () => void
  setSelectedChain: (chain: ChainConfig) => void
  autoLockMessage: string | null
  clearAutoLockMessage: () => void
  triggerAutoLock: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<PublicAccount | null>(null)
  const [selectedChain, setSelectedChain] = useState<ChainConfig>(CHAINS[0])
  const [autoLockMessage, setAutoLockMessage] = useState<string | null>(null)

  const unlock = useCallback((phrase: string) => {
    assertSecureContext()
    const publicAccount = unlockSession(phrase)
    setAccount(publicAccount)
    setAutoLockMessage(null)
  }, [])

  const lock = useCallback(() => {
    lockSession()
    setAccount(null)
  }, [])

  const clearAutoLockMessage = useCallback(() => {
    setAutoLockMessage(null)
  }, [])

  const triggerAutoLock = useCallback(() => {
    lockSession()
    setAccount(null)
    setAutoLockMessage('به‌دلیل عدم فعالیت، کیف پول قفل شد.')
  }, [])

  const value = useMemo(
    () => ({
      account,
      selectedChain,
      unlock,
      lock,
      setSelectedChain,
      autoLockMessage,
      clearAutoLockMessage,
      triggerAutoLock,
    }),
    [
      account,
      selectedChain,
      unlock,
      lock,
      autoLockMessage,
      clearAutoLockMessage,
      triggerAutoLock,
    ],
  )

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
