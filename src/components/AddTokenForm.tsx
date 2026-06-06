import { useState } from 'react'
import type { ChainConfig } from '../lib/chains'
import { fetchTokenMetadata, isDuplicateToken } from '../lib/balance'
import type { Token } from '../lib/tokens'

interface AddTokenFormProps {
  chain: ChainConfig
  existingTokens: Token[]
  onAdd: (token: Token) => void
  onCancel: () => void
}

export function AddTokenForm({
  chain,
  existingTokens,
  onAdd,
  onCancel,
}: AddTokenFormProps) {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Token | null>(null)

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPreview(null)
    setLoading(true)

    try {
      const trimmed = address.trim()
      if (!trimmed) {
        setError('آدرس قرارداد را وارد کنید')
        return
      }

      if (isDuplicateToken(chain.id, trimmed, existingTokens)) {
        setError('این توکن قبلاً اضافه شده')
        return
      }

      const meta = await fetchTokenMetadata(chain, trimmed)
      setPreview(meta)
    } catch {
      setError('توکن پیدا نشد یا آدرس نامعتبر است')
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (preview) {
      onAdd(preview)
    }
  }

  return (
    <div className="add-token-form">
      <h3>افزودن توکن</h3>
      <p className="hint">
        آدرس قرارداد توکن روی {chain.name} را وارد کنید. اطلاعات به‌صورت خودکار
        خوانده می‌شود.
      </p>

      <form onSubmit={handleLookup}>
        <div className="input-group">
          <label htmlFor="token-address">آدرس قرارداد</label>
          <input
            id="token-address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              setPreview(null)
              setError('')
            }}
            placeholder={chain.type === 'evm' ? '0x...' : 'T...'}
            dir="ltr"
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            انصراف
          </button>
          <button type="submit" className="btn-primary btn-sm" disabled={loading}>
            {loading ? 'در حال بررسی...' : 'بررسی توکن'}
          </button>
        </div>
      </form>

      {preview && (
        <div className="token-preview">
          <div className="token-preview-row">
            <span className="token-symbol-lg">{preview.symbol}</span>
            <span className="token-name-sm">{preview.name}</span>
          </div>
          <p dir="ltr" className="mono token-preview-addr">{preview.address}</p>
          <p className="hint">اعشار: {preview.decimals}</p>
          <button type="button" className="btn-primary" onClick={handleConfirm}>
            افزودن {preview.symbol}
          </button>
        </div>
      )}
    </div>
  )
}
