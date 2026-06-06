import { TronWeb } from 'tronweb'
import type { ChainConfig } from './chains'
import type { PublicAccount } from './wallet'
import type { TransactionRecord, TxDirection } from './transactionStore'
import { txRecordId } from './transactionStore'

const BLOCKSCOUT: Record<string, string> = {
  ethereum: 'https://eth.blockscout.com',
  bsc: 'https://bsc.blockscout.com',
  polygon: 'https://polygon.blockscout.com',
}

export interface HistoryFetchResult {
  transactions: TransactionRecord[]
  warnings: string[]
}

interface BlockscoutTx {
  hash: string
  from?: { hash: string }
  to?: { hash: string }
  value?: string
  timestamp?: string
  result?: string
}

interface BlockscoutTokenTx {
  transaction_hash: string
  from?: { hash: string }
  to?: { hash: string }
  total?: { value: string; decimals: string; symbol: string }
  token?: { address_hash: string; symbol: string; decimals: string }
  timestamp?: string
}

interface TronTx {
  txID: string
  block_timestamp?: number
  ret?: { contractRet: string }[]
  raw_data?: {
    contract?: {
      parameter?: {
        value?: {
          owner_address?: string
          to_address?: string
          amount?: number
        }
      }
      type?: string
    }[]
  }
}

interface TronTrc20Tx {
  transaction_id: string
  block_timestamp?: number
  from?: string
  to?: string
  value?: string
  token_info?: { symbol: string; address: string; decimals: number }
}

export async function fetchTransactionHistory(
  chain: ChainConfig,
  account: PublicAccount,
): Promise<HistoryFetchResult> {
  if (chain.type === 'evm') {
    return fetchEvmHistory(chain, account.evmAddress)
  }
  return fetchTronHistory(account.tronAddress, chain.id)
}

async function fetchEvmHistory(
  chain: ChainConfig,
  address: string,
): Promise<HistoryFetchResult> {
  const base = BLOCKSCOUT[chain.id]
  const warnings: string[] = []
  const records: TransactionRecord[] = []

  if (!base) {
    return {
      transactions: [],
      warnings: [`${chain.name}: منبع سابقه پیکربندی نشده`],
    }
  }

  const native = await fetchBlockscoutList<BlockscoutTx>(
    `${base}/api/v2/addresses/${address}/transactions`,
    chain.name,
    'تراکنش‌های بومی',
    warnings,
  )
  for (const tx of native) {
    const mapped = safeMap(() => mapBlockscoutNative(tx, chain, address))
    if (mapped) records.push(mapped)
  }

  const tokens = await fetchBlockscoutList<BlockscoutTokenTx>(
    `${base}/api/v2/addresses/${address}/token-transfers`,
    chain.name,
    'تراکنش‌های توکن',
    warnings,
  )
  for (const tx of tokens) {
    const mapped = safeMap(() => mapBlockscoutToken(tx, chain, address))
    if (mapped) records.push(mapped)
  }

  if (records.length === 0 && warnings.length > 0 && chain.id === 'bsc') {
    warnings.push('BSC: API عمومی explorer محدود است — فقط تراکنش‌های ارسالی از این کیف پول نمایش داده می‌شود')
  }

  return { transactions: records, warnings }
}

async function fetchBlockscoutList<T>(
  url: string,
  chainName: string,
  label: string,
  warnings: string[],
): Promise<T[]> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      warnings.push(`${chainName}: ${label} (${res.status})`)
      return []
    }
    const json = (await res.json()) as { items?: T[] }
    return json.items ?? []
  } catch (err) {
    warnings.push(`${chainName}: ${label} — ${fetchErrorMessage(err)}`)
    return []
  }
}

async function fetchTronHistory(
  address: string,
  chainId: string,
): Promise<HistoryFetchResult> {
  const warnings: string[] = []
  const records: TransactionRecord[] = []

  const trx = await fetchTronList<TronTx>(
    `https://api.trongrid.io/v1/accounts/${address}/transactions?limit=25&order_by=block_timestamp,desc`,
    'TRON',
    'تراکنش TRX',
    warnings,
  )
  for (const tx of trx) {
    const mapped = safeMap(() => mapTronNative(tx, chainId, address))
    if (mapped) records.push(mapped)
  }

  const trc20 = await fetchTronList<TronTrc20Tx>(
    `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=25&order_by=block_timestamp,desc`,
    'TRON',
    'تراکنش TRC-20',
    warnings,
  )
  for (const tx of trc20) {
    const mapped = safeMap(() => mapTronTrc20(tx, chainId, address))
    if (mapped) records.push(mapped)
  }

  return { transactions: records, warnings }
}

async function fetchTronList<T>(
  url: string,
  chainName: string,
  label: string,
  warnings: string[],
): Promise<T[]> {
  try {
    const res = await fetch(url)
    const json = (await res.json()) as { data?: T[]; success?: boolean; error?: string }
    if (!res.ok || json.success === false) {
      warnings.push(`${chainName}: ${label}${json.error ? ` — ${json.error}` : ` (${res.status})`}`)
      return []
    }
    return json.data ?? []
  } catch (err) {
    warnings.push(`${chainName}: ${label} — ${fetchErrorMessage(err)}`)
    return []
  }
}

function fetchErrorMessage(err: unknown): string {
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'اتصال برقرار نشد (شبکه، فیلتر یا افزونه مرورگر)'
  }
  if (err instanceof Error) return err.message
  return 'خطای ناشناخته'
}

function safeMap<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}

function mapBlockscoutNative(
  tx: BlockscoutTx,
  chain: ChainConfig,
  userAddress: string,
): TransactionRecord | null {
  if (!tx.hash) return null
  const from = tx.from?.hash ?? ''
  const to = tx.to?.hash ?? ''
  const valueWei = safeBigInt(tx.value)
  const amount = valueWei === 0n ? '0' : formatWei(valueWei)

  return {
    id: txRecordId(chain.id, tx.hash),
    chainId: chain.id,
    hash: tx.hash,
    direction: directionOf(from, to, userAddress),
    from,
    to,
    amount,
    symbol: chain.symbol,
    timestamp: parseTimestamp(tx.timestamp),
    status: tx.result === 'failed' ? 'failed' : 'confirmed',
  }
}

function mapBlockscoutToken(
  tx: BlockscoutTokenTx,
  chain: ChainConfig,
  userAddress: string,
): TransactionRecord | null {
  if (!tx.transaction_hash) return null
  const from = tx.from?.hash ?? ''
  const to = tx.to?.hash ?? ''
  const decimals = safeDecimals(tx.total?.decimals ?? tx.token?.decimals)
  const raw = safeBigInt(tx.total?.value)
  const symbol = tx.total?.symbol ?? tx.token?.symbol ?? 'TOKEN'

  return {
    id: txRecordId(chain.id, tx.transaction_hash),
    chainId: chain.id,
    hash: tx.transaction_hash,
    direction: directionOf(from, to, userAddress),
    from,
    to,
    amount: formatUnits(raw, decimals),
    symbol,
    tokenAddress: tx.token?.address_hash,
    timestamp: parseTimestamp(tx.timestamp),
    status: 'confirmed',
  }
}

function mapTronNative(
  tx: TronTx,
  chainId: string,
  userAddress: string,
): TransactionRecord | null {
  if (!tx.txID) return null
  const contract = tx.raw_data?.contract?.[0]
  if (!contract || contract.type !== 'TransferContract') return null

  const value = contract.parameter?.value
  if (!value?.owner_address || !value.to_address) return null

  const from = hexToTronAddress(value.owner_address)
  const to = hexToTronAddress(value.to_address)

  return {
    id: txRecordId(chainId, tx.txID),
    chainId,
    hash: tx.txID,
    direction: directionOf(from, to, userAddress),
    from,
    to,
    amount: String((value.amount ?? 0) / 1_000_000),
    symbol: 'TRX',
    timestamp: tx.block_timestamp ?? Date.now(),
    status: tx.ret?.[0]?.contractRet === 'SUCCESS' ? 'confirmed' : 'failed',
  }
}

function mapTronTrc20(
  tx: TronTrc20Tx,
  chainId: string,
  userAddress: string,
): TransactionRecord | null {
  if (!tx.transaction_id) return null
  const from = tx.from ?? ''
  const to = tx.to ?? ''
  const decimals = safeDecimals(tx.token_info?.decimals)

  return {
    id: txRecordId(chainId, tx.transaction_id),
    chainId,
    hash: tx.transaction_id,
    direction: directionOf(from, to, userAddress),
    from,
    to,
    amount: formatUnits(safeBigInt(tx.value), decimals),
    symbol: tx.token_info?.symbol ?? 'TRC20',
    tokenAddress: tx.token_info?.address,
    timestamp: tx.block_timestamp ?? Date.now(),
    status: 'confirmed',
  }
}

function directionOf(from: string, _to: string, user: string): TxDirection {
  const match = (a: string, b: string) =>
    a.startsWith('T') ? a === b : a.toLowerCase() === b.toLowerCase()
  if (match(from, user)) return 'out'
  return 'in'
}

function safeBigInt(value: unknown): bigint {
  try {
    if (value === undefined || value === null || value === '') return 0n
    if (typeof value === 'bigint') return value
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value))
    const str = String(value).trim()
    if (!/^\d+$/.test(str)) return 0n
    return BigInt(str)
  } catch {
    return 0n
  }
}

function safeDecimals(value: unknown): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 36) return 18
  return n
}

function parseTimestamp(value: string | undefined): number {
  if (!value) return Date.now()
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? ts : Date.now()
}

function formatWei(wei: bigint): string {
  const eth = Number(wei) / 1e18
  if (eth === 0) return '0'
  return eth.toFixed(6).replace(/\.?0+$/, '')
}

function formatUnits(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return fracStr ? `${whole}.${fracStr}` : whole.toString()
}

function hexToTronAddress(hex: string): string {
  const normalized = hex.startsWith('41') ? hex : hex.replace(/^0x/, '')
  try {
    return TronWeb.address.fromHex(normalized) ?? hex
  } catch {
    return hex
  }
}

export function buildSendReceipt(
  chain: ChainConfig,
  hash: string,
  from: string,
  to: string,
  amount: string,
  symbol: string,
  tokenAddress?: string,
): import('./transactionStore').TxReceiptData {
  return {
    kind: 'send',
    chainId: chain.id,
    chainName: chain.name,
    explorerUrl: chain.explorerUrl,
    hash,
    from,
    to,
    amount,
    symbol,
    tokenAddress,
    timestamp: Date.now(),
    status: 'confirmed',
  }
}

export function buildReceiveReceipt(
  chain: ChainConfig,
  address: string,
  symbol: string,
  tokenAddress?: string,
): import('./transactionStore').TxReceiptData {
  return {
    kind: 'receive',
    chainId: chain.id,
    chainName: chain.name,
    explorerUrl: chain.explorerUrl,
    from: '—',
    to: address,
    symbol,
    tokenAddress,
    timestamp: Date.now(),
    status: 'confirmed',
    note: 'پس از واریز، تراکنش در سابقه ظاهر می‌شود.',
  }
}

export function receiptToLocalTx(
  receipt: import('./transactionStore').TxReceiptData,
  chain: ChainConfig,
): TransactionRecord | null {
  if (receipt.kind !== 'send' || !receipt.hash || !receipt.amount) return null

  return {
    id: txRecordId(chain.id, receipt.hash),
    chainId: chain.id,
    hash: receipt.hash,
    direction: 'out',
    from: receipt.from,
    to: receipt.to,
    amount: receipt.amount,
    symbol: receipt.symbol,
    tokenAddress: receipt.tokenAddress,
    timestamp: receipt.timestamp,
    status: receipt.status,
    local: true,
  }
}
