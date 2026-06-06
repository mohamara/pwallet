export type ChainType = 'evm' | 'tron'

export interface ChainConfig {
  id: string
  name: string
  symbol: string
  type: ChainType
  rpcUrl: string
  explorerUrl: string
  chainId?: number
}

export const CHAINS: ChainConfig[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    type: 'evm',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorerUrl: 'https://etherscan.io',
    chainId: 1,
  },
  {
    id: 'bsc',
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    type: 'evm',
    rpcUrl: 'https://bsc-rpc.publicnode.com',
    explorerUrl: 'https://bscscan.com',
    chainId: 56,
  },
  {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'POL',
    type: 'evm',
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    explorerUrl: 'https://polygonscan.com',
    chainId: 137,
  },
  {
    id: 'tron',
    name: 'TRON',
    symbol: 'TRX',
    type: 'tron',
    rpcUrl: 'https://api.trongrid.io',
    explorerUrl: 'https://tronscan.org',
  },
]

export function getChain(id: string): ChainConfig {
  const chain = CHAINS.find((c) => c.id === id)
  if (!chain) throw new Error(`Unknown chain: ${id}`)
  return chain
}
