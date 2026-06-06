import type { ChainConfig } from '../lib/chains'
import {
  explorerTxUrl,
  formatTxTime,
  shortHash,
  type TransactionRecord,
} from '../lib/transactionStore'

interface TransactionHistoryProps {
  chain: ChainConfig
  transactions: TransactionRecord[]
  loading: boolean
  error: string
  warnings?: string[]
  onRefresh: () => void
  onSelect?: (tx: TransactionRecord) => void
}

export function TransactionHistory({
  chain,
  transactions,
  loading,
  error,
  warnings = [],
  onRefresh,
  onSelect,
}: TransactionHistoryProps) {
  return (
    <div className="history-panel">
      <div className="section-header">
        <h3>سابقه تراکنش‌ها</h3>
        <button type="button" className="btn-ghost btn-sm-inline" onClick={onRefresh}>
          {loading ? '...' : 'بروزرسانی'}
        </button>
      </div>

      {error && <p className="history-warning">{error}</p>}
      {warnings.length > 0 && (
        <ul className="history-warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {loading && transactions.length === 0 ? (
        <p className="hint">در حال بارگذاری...</p>
      ) : transactions.length === 0 ? (
        <p className="hint">تراکنشی برای این شبکه یافت نشد.</p>
      ) : (
        <ul className="history-list">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <button
                type="button"
                className="history-item"
                onClick={() => onSelect?.(tx)}
              >
                <div className={`history-dir ${tx.direction}`}>
                  {tx.direction === 'in' ? '↓' : '↑'}
                </div>
                <div className="history-body">
                  <div className="history-top">
                    <span className="history-symbol">
                      {tx.direction === 'in' ? 'دریافت' : 'ارسال'} {tx.symbol}
                    </span>
                    <span className={`history-amount ${tx.direction}`} dir="ltr">
                      {tx.direction === 'in' ? '+' : '-'}
                      {tx.amount}
                    </span>
                  </div>
                  <div className="history-meta">
                    <span>{formatTxTime(tx.timestamp)}</span>
                    <span dir="ltr">{shortHash(tx.hash)}</span>
                    {tx.local && <span className="local-badge">محلی</span>}
                  </div>
                </div>
              </button>
              <a
                className="history-explorer"
                href={explorerTxUrl(chain.explorerUrl, tx.hash, chain.type)}
                target="_blank"
                rel="noreferrer"
                title="Explorer"
              >
                ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function txToReceipt(
  tx: TransactionRecord,
  chain: ChainConfig,
): import('../lib/transactionStore').TxReceiptData {
  return {
    kind: tx.direction === 'out' ? 'send' : 'receive',
    chainId: chain.id,
    chainName: chain.name,
    explorerUrl: chain.explorerUrl,
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    symbol: tx.symbol,
    tokenAddress: tx.tokenAddress,
    timestamp: tx.timestamp,
    status: tx.status,
  }
}
