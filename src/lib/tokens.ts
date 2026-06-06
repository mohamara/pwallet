import { sanitizeStoredTokens } from './validation'

export interface Token {
  id: string
  chainId: string
  address: string
  symbol: string
  name: string
  decimals: number
  isDefault?: boolean
}

export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
] as const

export const DEFAULT_USDT: Record<string, Omit<Token, 'id'>> = {
  ethereum: {
    chainId: 'ethereum',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isDefault: true,
  },
  bsc: {
    chainId: 'bsc',
    address: '0x55d398326f99059fF775485246999027B3197955',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 18,
    isDefault: true,
  },
  polygon: {
    chainId: 'polygon',
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isDefault: true,
  },
  tron: {
    chainId: 'tron',
    address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isDefault: true,
  },
}

const STORAGE_KEY = 'pwallet-custom-tokens'

export function tokenId(chainId: string, address: string): string {
  const normalized = chainId === 'tron' ? address : address.toLowerCase()
  return `${chainId}:${normalized}`
}

export function buildToken(
  chainId: string,
  address: string,
  symbol: string,
  name: string,
  decimals: number,
  isDefault = false,
): Token {
  return {
    id: tokenId(chainId, address),
    chainId,
    address,
    symbol,
    name,
    decimals,
    isDefault,
  }
}

export function getDefaultTokensForChain(chainId: string): Token[] {
  const usdt = DEFAULT_USDT[chainId]
  if (!usdt) return []
  return [buildToken(chainId, usdt.address, usdt.symbol, usdt.name, usdt.decimals, true)]
}

export function loadCustomTokens(): Token[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return sanitizeStoredTokens(parsed)
  } catch {
    return []
  }
}

export function saveCustomTokens(tokens: Token[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function getTokensForChain(chainId: string): Token[] {
  const defaults = getDefaultTokensForChain(chainId)
  const custom = loadCustomTokens().filter((t) => t.chainId === chainId)
  const seen = new Set(defaults.map((t) => t.id))
  const merged = [...defaults]
  for (const t of custom) {
    if (!seen.has(t.id)) merged.push(t)
  }
  return merged
}

export function addCustomToken(token: Token): void {
  const existing = loadCustomTokens()
  if (existing.some((t) => t.id === token.id)) return
  saveCustomTokens([...existing, { ...token, isDefault: false }])
}

export function removeCustomToken(tokenIdToRemove: string): void {
  const filtered = loadCustomTokens().filter((t) => t.id !== tokenIdToRemove)
  saveCustomTokens(filtered)
}

export type Asset =
  | { kind: 'native' }
  | { kind: 'token'; token: Token }

export function assetLabel(asset: Asset, nativeSymbol: string): string {
  return asset.kind === 'native' ? nativeSymbol : asset.token.symbol
}
