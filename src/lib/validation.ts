import { ethers } from 'ethers'
import { TronWeb } from 'tronweb'
import type { ChainConfig } from './chains'

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
const AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/

export function validateRecipient(
  chain: ChainConfig,
  address: string,
): string {
  const trimmed = address.trim()
  if (!trimmed) throw new Error('آدرس مقصد خالی است')

  if (chain.type === 'evm') {
    if (!EVM_ADDRESS.test(trimmed)) {
      throw new Error('آدرس EVM نامعتبر است')
    }
    return ethers.getAddress(trimmed)
  }

  if (!TRON_ADDRESS.test(trimmed) || !TronWeb.isAddress(trimmed)) {
    throw new Error('آدرس TRON نامعتبر است')
  }
  return trimmed
}

export function validateAmount(amount: string): string {
  const trimmed = amount.trim()
  if (!AMOUNT.test(trimmed)) {
    throw new Error('مقدار نامعتبر است')
  }
  if (Number(trimmed) <= 0) {
    throw new Error('مقدار باید بزرگ‌تر از صفر باشد')
  }
  return trimmed
}

export function validateContractAddress(
  chain: ChainConfig,
  address: string,
): string {
  const trimmed = address.trim()
  if (!trimmed) throw new Error('آدرس قرارداد خالی است')

  if (chain.type === 'evm') {
    if (!EVM_ADDRESS.test(trimmed)) {
      throw new Error('آدرس قرارداد EVM نامعتبر است')
    }
    return ethers.getAddress(trimmed)
  }

  if (!TRON_ADDRESS.test(trimmed) || !TronWeb.isAddress(trimmed)) {
    throw new Error('آدرس قرارداد TRON نامعتبر است')
  }
  return trimmed
}

export function sanitizeTokenField(value: unknown, maxLen = 40): string {
  const str = String(value ?? '')
    .replace(/[<>"'`\\]/g, '')
    .trim()
    .slice(0, maxLen)
  return str || 'UNKNOWN'
}

export function sanitizeStoredTokens(raw: unknown): import('./tokens').Token[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      id: String(item.id ?? '').slice(0, 120),
      chainId: String(item.chainId ?? '').slice(0, 32),
      address: String(item.address ?? '').slice(0, 64),
      symbol: sanitizeTokenField(item.symbol, 16),
      name: sanitizeTokenField(item.name, 64),
      decimals: clampDecimals(item.decimals),
      isDefault: false,
    }))
    .filter(
      (t) =>
        t.id &&
        t.chainId &&
        t.address &&
        t.symbol &&
        Number.isFinite(t.decimals),
    )
}

function clampDecimals(value: unknown): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 36) return 18
  return n
}
