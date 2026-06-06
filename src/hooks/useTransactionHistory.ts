import { useCallback, useEffect, useState } from 'react'
import type { ChainConfig } from '../lib/chains'
import {
  loadLocalTransactions,
  mergeTransactions,
  type TransactionRecord,
} from '../lib/transactionStore'
import { fetchTransactionHistory } from '../lib/transactions'
import type { PublicAccount } from '../lib/wallet'

function filterLocal(chain: ChainConfig, userAddress: string): TransactionRecord[] {
  return loadLocalTransactions().filter((t) => {
    if (t.chainId !== chain.id) return false
    if (chain.type === 'tron') {
      return t.from === userAddress || t.to === userAddress
    }
    const u = userAddress.toLowerCase()
    return t.from.toLowerCase() === u || t.to.toLowerCase() === u
  })
}

export function useTransactionHistory(
  chain: ChainConfig,
  account: PublicAccount | null,
) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  const reload = useCallback(async () => {
    if (!account) {
      setTransactions([])
      setWarnings([])
      return
    }

    setLoading(true)
    setError('')
    setWarnings([])

    const userAddress =
      chain.type === 'evm' ? account.evmAddress : account.tronAddress
    const local = filterLocal(chain, userAddress)

    try {
      const { transactions: remote, warnings: fetchWarnings } =
        await fetchTransactionHistory(chain, account)
      const merged = mergeTransactions(remote, local)
      setTransactions(merged)
      setWarnings(fetchWarnings)

      if (merged.length === 0 && fetchWarnings.length > 0) {
        setError(
          'سابقه آنلاین بارگذاری نشد. تراکنش‌های ارسالی از این کیف پول (در صورت وجود) نمایش داده می‌شوند.',
        )
      } else if (fetchWarnings.length > 0 && remote.length === 0 && local.length > 0) {
        setError('سابقه آنلاین در دسترس نیست — فقط تراکنش‌های محلی نمایش داده شد')
      }
    } catch (err) {
      const sorted = local.sort((a, b) => b.timestamp - a.timestamp)
      setTransactions(sorted)
      setError('بارگذاری سابقه آنلاین ناموفق بود — تراکنش‌های محلی نمایش داده شد')
      if (err instanceof Error) {
        setWarnings([err.message])
      }
    } finally {
      setLoading(false)
    }
  }, [chain, account])

  useEffect(() => {
    reload()
  }, [reload])

  return { transactions, loading, error, warnings, reload }
}
