import { useCallback, useEffect, useState } from 'react'
import { fetchTokenBalance } from '../lib/balance'
import type { ChainConfig } from '../lib/chains'
import type { PublicAccount } from '../lib/wallet'
import {
  addCustomToken,
  getTokensForChain,
  removeCustomToken,
  type Token,
} from '../lib/tokens'

export function useTokens(chainId: string) {
  const [tokens, setTokens] = useState<Token[]>(() => getTokensForChain(chainId))
  const [version, setVersion] = useState(0)

  useEffect(() => {
    setTokens(getTokensForChain(chainId))
  }, [chainId, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const addToken = useCallback(
    (token: Token) => {
      addCustomToken(token)
      refresh()
    },
    [refresh],
  )

  const removeToken = useCallback(
    (id: string) => {
      removeCustomToken(id)
      refresh()
    },
    [refresh],
  )

  return { tokens, addToken, removeToken, refresh }
}

export interface TokenBalance {
  token: Token
  balance: string | null
  loading: boolean
}

export function useTokenBalances(
  chain: ChainConfig,
  account: PublicAccount | null,
  tokens: Token[],
) {
  const [balances, setBalances] = useState<TokenBalance[]>([])

  useEffect(() => {
    if (!account || tokens.length === 0) {
      setBalances([])
      return
    }

    let cancelled = false
    setBalances(tokens.map((token) => ({ token, balance: null, loading: true })))

    Promise.all(
      tokens.map(async (token) => {
        try {
          const balance = await fetchTokenBalance(chain, account, token)
          return { token, balance, loading: false }
        } catch {
          return { token, balance: '—', loading: false }
        }
      }),
    ).then((results) => {
      if (!cancelled) setBalances(results)
    })

    return () => {
      cancelled = true
    }
  }, [chain, account, tokens])

  return balances
}
