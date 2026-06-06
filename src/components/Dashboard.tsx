import { useEffect, useMemo, useState } from 'react'
import type { ChainConfig } from '../lib/chains'
import { fetchBalance, sendNative, sendToken } from '../lib/balance'
import { assetLabel, type Asset, type Token } from '../lib/tokens'
import type { TxReceiptData } from '../lib/transactionStore'
import { saveLocalTransaction } from '../lib/transactionStore'
import {
  buildReceiveReceipt,
  buildSendReceipt,
  receiptToLocalTx,
} from '../lib/transactions'
import type { PublicAccount } from '../lib/wallet'
import { formatAutoLockMinutes } from '../hooks/useWalletSecurity'
import { useTokenBalances, useTokens } from '../hooks/useTokens'
import { useTransactionHistory } from '../hooks/useTransactionHistory'
import { AddTokenForm } from './AddTokenForm'
import { CopyButton } from './CopyButton'
import { TokenList } from './TokenList'
import { TransactionHistory, txToReceipt } from './TransactionHistory'
import { TxReceiptModal } from './TxReceiptModal'

interface DashboardProps {
  account: PublicAccount
  selectedChain: ChainConfig
  onChainChange: (chain: ChainConfig) => void
  chains: ChainConfig[]
  onLock: () => void
}

type Tab = 'assets' | 'send' | 'receive' | 'history' | 'add-token'

export function Dashboard({
  account,
  selectedChain,
  onChainChange,
  chains,
  onLock,
}: DashboardProps) {
  const [tab, setTab] = useState<Tab>('assets')
  const [nativeBalance, setNativeBalance] = useState<string | null>(null)
  const [loadingNative, setLoadingNative] = useState(false)
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendAsset, setSendAsset] = useState<Asset>({ kind: 'native' })
  const [receiveAsset, setReceiveAsset] = useState<Asset>({ kind: 'native' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<TxReceiptData | null>(null)

  const { tokens, addToken, removeToken, refresh } = useTokens(selectedChain.id)
  const tokenBalances = useTokenBalances(selectedChain, account, tokens)
  const { transactions, loading: historyLoading, error: historyError, warnings: historyWarnings, reload: reloadHistory } =
    useTransactionHistory(selectedChain, account)

  const address =
    selectedChain.type === 'evm' ? account.evmAddress : account.tronAddress

  const selectedToken = useMemo(() => {
    if (sendAsset.kind !== 'token') return null
    return tokens.find((t) => t.id === sendAsset.token.id) ?? sendAsset.token
  }, [sendAsset, tokens])

  useEffect(() => {
    let cancelled = false
    setLoadingNative(true)
    setNativeBalance(null)

    fetchBalance(selectedChain, account)
      .then((b) => {
        if (!cancelled) setNativeBalance(b)
      })
      .catch(() => {
        if (!cancelled) setNativeBalance('—')
      })
      .finally(() => {
        if (!cancelled) setLoadingNative(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedChain, account])

  async function refreshBalances() {
    const b = await fetchBalance(selectedChain, account)
    setNativeBalance(b)
    refresh()
    reloadHistory()
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSending(true)

    const to = sendTo.trim()
    const amount = sendAmount.trim()
    const symbol = assetLabel(sendAsset, selectedChain.symbol)
    const tokenAddress =
      sendAsset.kind === 'token' ? sendAsset.token.address : undefined

    try {
      let hash: string
      if (sendAsset.kind === 'native') {
        hash = await sendNative(selectedChain, to, amount)
      } else {
        hash = await sendToken(selectedChain, sendAsset.token, to, amount)
      }

      const receiptData = buildSendReceipt(
        selectedChain,
        hash,
        address,
        to,
        amount,
        symbol,
        tokenAddress,
      )
      const localTx = receiptToLocalTx(receiptData, selectedChain)
      if (localTx) saveLocalTransaction(localTx)

      setSendTo('')
      setSendAmount('')
      setReceipt(receiptData)
      await refreshBalances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال ناموفق بود')
    } finally {
      setSending(false)
    }
  }

  function handleReceiveConfirm() {
    const symbol = assetLabel(receiveAsset, selectedChain.symbol)
    const tokenAddress =
      receiveAsset.kind === 'token' ? receiveAsset.token.address : undefined
    setReceipt(buildReceiveReceipt(selectedChain, address, symbol, tokenAddress))
  }

  function handleAddToken(token: Token) {
    addToken(token)
    setTab('assets')
  }

  function selectTokenForSend(token: Token) {
    setSendAsset({ kind: 'token', token })
  }

  function closeReceipt() {
    setReceipt(null)
    if (tab === 'send') setTab('history')
  }

  const sendLabel = assetLabel(sendAsset, selectedChain.symbol)
  const receiveLabel = assetLabel(receiveAsset, selectedChain.symbol)

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="brand">
          <span className="logo-mark small">P</span>
          <span>PWallet</span>
        </div>
        <button type="button" className="btn-ghost" onClick={onLock}>
          قفل کردن
        </button>
      </header>

      <div className="chain-selector">
        {chains.map((chain) => (
          <button
            key={chain.id}
            type="button"
            className={`chain-chip ${selectedChain.id === chain.id ? 'active' : ''}`}
            onClick={() => onChainChange(chain)}
          >
            {chain.name}
          </button>
        ))}
      </div>

      <div className="balance-card">
        <p className="balance-label">موجودی {selectedChain.name}</p>
        <p className="balance-value">
          {loadingNative ? '...' : nativeBalance ?? '—'}{' '}
          <span>{selectedChain.symbol}</span>
        </p>
        <p className="address-row" dir="ltr">
          {address.slice(0, 10)}...{address.slice(-8)}
          <CopyButton text={address} />
        </p>
      </div>

      <nav className="tabs tabs-scroll">
        <button type="button" className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}>
          دارایی‌ها
        </button>
        <button type="button" className={tab === 'send' ? 'active' : ''} onClick={() => setTab('send')}>
          ارسال
        </button>
        <button type="button" className={tab === 'receive' ? 'active' : ''} onClick={() => setTab('receive')}>
          دریافت
        </button>
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          سابقه
        </button>
        <button type="button" className={tab === 'add-token' ? 'active' : ''} onClick={() => setTab('add-token')}>
          + توکن
        </button>
      </nav>

      <div className="tab-panel">
        {tab === 'assets' && (
          <div className="assets-panel">
            <div className="native-asset-row">
              <div className="token-icon native">{selectedChain.symbol.slice(0, 1)}</div>
              <div className="token-info">
                <span className="token-symbol">{selectedChain.symbol}</span>
                <span className="token-name">ارز بومی {selectedChain.name}</span>
              </div>
              <div className="token-balance" dir="ltr">
                {loadingNative ? '...' : nativeBalance ?? '—'}
              </div>
            </div>

            <div className="section-header">
              <h3>توکن‌ها</h3>
              <span className="hint">USDT به‌صورت پیش‌فرض فعال است</span>
            </div>
            <TokenList tokenBalances={tokenBalances} onRemove={removeToken} />

            <div className="info-card addresses-card">
              <h3>آدرس EVM</h3>
              <p dir="ltr" className="mono">{account.evmAddress}</p>
              <CopyButton text={account.evmAddress} />
              <h3 className="mt">آدرس TRON (TRC)</h3>
              <p dir="ltr" className="mono">{account.tronAddress}</p>
              <CopyButton text={account.tronAddress} />
            </div>

            <p className="hint security-hint">
              قفل خودکار پس از {formatAutoLockMinutes()} دقیقه عدم فعالیت.
            </p>
          </div>
        )}

        {tab === 'send' && (
          <form className="send-form" onSubmit={handleSend}>
            <div className="input-group">
              <label>دارایی</label>
              <div className="asset-picker">
                <button
                  type="button"
                  className={`asset-chip ${sendAsset.kind === 'native' ? 'active' : ''}`}
                  onClick={() => setSendAsset({ kind: 'native' })}
                >
                  {selectedChain.symbol}
                </button>
                {tokens.map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    className={`asset-chip ${sendAsset.kind === 'token' && sendAsset.token.id === token.id ? 'active' : ''}`}
                    onClick={() => selectTokenForSend(token)}
                  >
                    {token.symbol}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="to">آدرس مقصد</label>
              <input
                id="to"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder={selectedChain.type === 'evm' ? '0x...' : 'T...'}
                dir="ltr"
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="amount">مقدار ({sendLabel})</label>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0.0"
                dir="ltr"
                required
              />
            </div>
            {sendAsset.kind === 'token' && selectedToken && (
              <p className="hint" dir="ltr">
                قرارداد: {selectedToken.address}
              </p>
            )}
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? 'در حال ارسال...' : `ارسال ${sendLabel}`}
            </button>
          </form>
        )}

        {tab === 'receive' && (
          <div className="receive-panel">
            <p>دارایی مورد نظر برای دریافت را انتخاب کنید:</p>
            <div className="asset-picker receive-picker">
              <button
                type="button"
                className={`asset-chip ${receiveAsset.kind === 'native' ? 'active' : ''}`}
                onClick={() => setReceiveAsset({ kind: 'native' })}
              >
                {selectedChain.symbol}
              </button>
              {tokens.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  className={`asset-chip ${receiveAsset.kind === 'token' && receiveAsset.token.id === token.id ? 'active' : ''}`}
                  onClick={() => setReceiveAsset({ kind: 'token', token })}
                >
                  {token.symbol}
                </button>
              ))}
            </div>

            <p className="mt hint">
              آدرس {selectedChain.name} برای دریافت {receiveLabel}:
            </p>
            <div className="receive-address" dir="ltr">
              {address}
            </div>
            <div className="receive-actions">
              <CopyButton text={address} label="کپی آدرس" />
              <button type="button" className="btn-primary btn-sm" onClick={handleReceiveConfirm}>
                تأیید و نمایش رسید
              </button>
            </div>

            {receiveAsset.kind === 'token' && (
              <p className="hint" dir="ltr">
                قرارداد توکن: {receiveAsset.token.address}
              </p>
            )}
          </div>
        )}

        {tab === 'history' && (
          <TransactionHistory
            chain={selectedChain}
            transactions={transactions}
            loading={historyLoading}
            error={historyError}
            warnings={historyWarnings}
            onRefresh={reloadHistory}
            onSelect={(tx) => setReceipt(txToReceipt(tx, selectedChain))}
          />
        )}

        {tab === 'add-token' && (
          <AddTokenForm
            chain={selectedChain}
            existingTokens={tokens}
            onAdd={handleAddToken}
            onCancel={() => setTab('assets')}
          />
        )}
      </div>

      {receipt && (
        <TxReceiptModal
          receipt={receipt}
          chain={selectedChain}
          onClose={closeReceipt}
        />
      )}
    </div>
  )
}
