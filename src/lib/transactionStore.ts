export type TxDirection = 'in' | 'out'
export type TxStatus = 'pending' | 'confirmed' | 'failed'

export interface TransactionRecord {
  id: string
  chainId: string
  hash: string
  direction: TxDirection
  from: string
  to: string
  amount: string
  symbol: string
  tokenAddress?: string
  timestamp: number
  status: TxStatus
  local?: boolean
}

export interface TxReceiptData {
  kind: 'send' | 'receive'
  chainId: string
  chainName: string
  explorerUrl: string
  hash?: string
  from: string
  to: string
  amount?: string
  symbol: string
  tokenAddress?: string
  timestamp: number
  status: TxStatus
  note?: string
}

const STORAGE_KEY = 'pwallet-tx-history'

export function txRecordId(chainId: string, hash: string): string {
  return `${chainId}:${hash.toLowerCase()}`
}

export function loadLocalTransactions(): TransactionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidRecord)
  } catch {
    return []
  }
}

export function saveLocalTransaction(record: TransactionRecord): void {
  const existing = loadLocalTransactions()
  const without = existing.filter((t) => t.id !== record.id)
  saveAll([record, ...without].slice(0, 200))
}

function saveAll(records: TransactionRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function isValidRecord(item: unknown): item is TransactionRecord {
  if (typeof item !== 'object' || item === null) return false
  const r = item as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.chainId === 'string' &&
    typeof r.hash === 'string' &&
    typeof r.amount === 'string' &&
    typeof r.timestamp === 'number'
  )
}

export function mergeTransactions(
  remote: TransactionRecord[],
  local: TransactionRecord[],
): TransactionRecord[] {
  const map = new Map<string, TransactionRecord>()
  for (const tx of [...remote, ...local]) {
    const prev = map.get(tx.id)
    if (!prev || tx.local) map.set(tx.id, tx)
  }
  return [...map.values()].sort((a, b) => b.timestamp - a.timestamp)
}

export function formatTxTime(ts: number): string {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ts))
}

export function shortHash(hash: string): string {
  if (hash.length <= 16) return hash
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`
}

export function explorerTxUrl(explorerUrl: string, hash: string, chainType: 'evm' | 'tron'): string {
  if (chainType === 'evm') return `${explorerUrl}/tx/${hash}`
  return `${explorerUrl}/#/transaction/${hash}`
}
