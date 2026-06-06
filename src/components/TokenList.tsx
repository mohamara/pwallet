import type { TokenBalance } from '../hooks/useTokens'

interface TokenListProps {
  tokenBalances: TokenBalance[]
  onRemove?: (tokenId: string) => void
  onSelect?: (tokenId: string) => void
  selectedTokenId?: string | null
  selectable?: boolean
}

export function TokenList({
  tokenBalances,
  onRemove,
  onSelect,
  selectedTokenId,
  selectable = false,
}: TokenListProps) {
  if (tokenBalances.length === 0) {
    return <p className="hint">توکنی برای این شبکه ثبت نشده.</p>
  }

  return (
    <ul className="token-list">
      {tokenBalances.map(({ token, balance, loading }) => (
        <li
          key={token.id}
          className={`token-item ${selectable && selectedTokenId === token.id ? 'selected' : ''}`}
        >
          {selectable ? (
            <button
              type="button"
              className="token-item-btn"
              onClick={() => onSelect?.(token.id)}
            >
              <TokenRow token={token} balance={balance} loading={loading} />
            </button>
          ) : (
            <TokenRow token={token} balance={balance} loading={loading} />
          )}
          {!token.isDefault && onRemove && (
            <button
              type="button"
              className="btn-remove-token"
              onClick={() => onRemove(token.id)}
              title="حذف توکن"
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function TokenRow({
  token,
  balance,
  loading,
}: {
  token: TokenBalance['token']
  balance: string | null
  loading: boolean
}) {
  return (
    <div className="token-row">
      <div className="token-icon">{token.symbol.slice(0, 1)}</div>
      <div className="token-info">
        <span className="token-symbol">{token.symbol}</span>
        <span className="token-name">{token.name}</span>
      </div>
      <div className="token-balance" dir="ltr">
        {loading ? '...' : balance ?? '—'}
      </div>
    </div>
  )
}
