import { Buffer } from 'buffer'
import { WalletProvider, useWallet } from './context/WalletContext'
import { UnlockScreen } from './components/UnlockScreen'
import { Dashboard } from './components/Dashboard'
import { SecureContextBanner } from './components/SecureContextBanner'
import { useWalletSecurity } from './hooks/useWalletSecurity'
import { CHAINS } from './lib/chains'
import './App.css'

globalThis.Buffer = Buffer

function WalletApp() {
  const {
    account,
    unlock,
    lock,
    selectedChain,
    setSelectedChain,
    autoLockMessage,
    clearAutoLockMessage,
    triggerAutoLock,
  } = useWallet()

  useWalletSecurity(triggerAutoLock)

  if (!account) {
    return (
      <>
        <SecureContextBanner />
        {autoLockMessage && (
          <div className="security-banner info" role="status">
            {autoLockMessage}
            <button type="button" className="banner-dismiss" onClick={clearAutoLockMessage}>
              ×
            </button>
          </div>
        )}
        <UnlockScreen
          onUnlock={unlock}
          secureContextError={
            typeof window !== 'undefined' && !window.isSecureContext
              ? 'اتصال امن (HTTPS) برقرار نیست.'
              : null
          }
        />
      </>
    )
  }

  return (
    <>
      <SecureContextBanner />
      <Dashboard
        account={account}
        selectedChain={selectedChain}
        onChainChange={setSelectedChain}
        chains={CHAINS}
        onLock={lock}
      />
    </>
  )
}

function App() {
  return (
    <WalletProvider>
      <WalletApp />
    </WalletProvider>
  )
}

export default App
