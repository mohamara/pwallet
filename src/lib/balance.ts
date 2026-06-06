import { ethers } from 'ethers'
import type { ChainConfig } from './chains'
import { requireSession } from './secureSession'
import { toSafeErrorMessage } from './safeError'
import { ERC20_ABI, buildToken, tokenId, type Token } from './tokens'
import { sanitizeTokenField, validateAmount, validateContractAddress, validateRecipient } from './validation'
import type { PublicAccount, SecretAccount } from './wallet'
import { getEthersWallet, getReadOnlyTronWeb, getTronWeb } from './wallet'

export async function fetchBalance(
  chain: ChainConfig,
  account: PublicAccount,
): Promise<string> {
  if (chain.type === 'evm') {
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId)
    const balance = await provider.getBalance(account.evmAddress)
    return ethers.formatEther(balance)
  }

  const tronWeb = getReadOnlyTronWeb()
  const sun = await tronWeb.trx.getBalance(account.tronAddress)
  return String(tronWeb.fromSun(sun))
}

export async function fetchTokenBalance(
  chain: ChainConfig,
  account: PublicAccount,
  token: Token,
): Promise<string> {
  if (chain.type === 'evm') {
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId)
    const contract = new ethers.Contract(token.address, ERC20_ABI, provider)
    const balance = await contract.balanceOf!(account.evmAddress)
    return ethers.formatUnits(balance, token.decimals)
  }

  const tronWeb = getReadOnlyTronWeb()
  const contract = await tronWeb.contract().at(token.address)
  const balance = await contract.balanceOf(account.tronAddress).call()
  const raw = typeof balance === 'bigint' ? balance : BigInt(String(balance))
  const divisor = 10n ** BigInt(token.decimals)
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(token.decimals, '0').replace(/0+$/, '')
  return fracStr ? `${whole}.${fracStr}` : whole.toString()
}

export async function fetchTokenMetadata(
  chain: ChainConfig,
  contractAddress: string,
): Promise<Token> {
  const validated = validateContractAddress(chain, contractAddress)

  if (chain.type === 'evm') {
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId)
    const contract = new ethers.Contract(validated, ERC20_ABI, provider)
    const [symbol, name, decimals] = await Promise.all([
      contract.symbol!(),
      contract.name!(),
      contract.decimals!(),
    ])
    return buildToken(
      chain.id,
      validated,
      sanitizeTokenField(symbol, 16),
      sanitizeTokenField(name, 64),
      Number(decimals),
    )
  }

  const tronWeb = getReadOnlyTronWeb()
  const contract = await tronWeb.contract().at(validated)
  const [symbol, name, decimals] = await Promise.all([
    contract.symbol().call(),
    contract.name().call(),
    contract.decimals().call(),
  ])
  return buildToken(
    chain.id,
    validated,
    sanitizeTokenField(symbol, 16),
    sanitizeTokenField(name, 64),
    Number(decimals),
  )
}

export async function sendNative(
  chain: ChainConfig,
  to: string,
  amount: string,
): Promise<string> {
  const account = requireSession()
  const recipient = validateRecipient(chain, to)
  const value = validateAmount(amount)

  try {
    if (chain.type === 'evm') {
      return await sendEvmNative(chain, account, recipient, value)
    }
    return await sendTronNative(account, recipient, value)
  } catch (err) {
    throw new Error(toSafeErrorMessage(err, 'ارسال ناموفق بود'))
  }
}

export async function sendToken(
  chain: ChainConfig,
  token: Token,
  to: string,
  amount: string,
): Promise<string> {
  const account = requireSession()
  const recipient = validateRecipient(chain, to)
  const value = validateAmount(amount)

  try {
    if (chain.type === 'evm') {
      return await sendEvmToken(chain, account, token, recipient, value)
    }
    return await sendTronToken(account, token, recipient, value)
  } catch (err) {
    throw new Error(toSafeErrorMessage(err, 'ارسال توکن ناموفق بود'))
  }
}

async function sendEvmNative(
  chain: ChainConfig,
  account: SecretAccount,
  to: string,
  amount: string,
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId)
  const wallet = getEthersWallet(account).connect(provider)
  const tx = await wallet.sendTransaction({
    to,
    value: ethers.parseEther(amount),
  })
  await tx.wait()
  return tx.hash
}

async function sendTronNative(
  account: SecretAccount,
  to: string,
  amount: string,
): Promise<string> {
  const tronWeb = getTronWeb(account)
  const sunRaw = tronWeb.toSun(Number(amount))
  const sun = Number(sunRaw)
  const tx = await tronWeb.trx.sendTransaction(to, sun)
  if (!tx.result) {
    throw new Error('تراکنش TRON ناموفق بود')
  }
  return tx.txid
}

async function sendEvmToken(
  chain: ChainConfig,
  account: SecretAccount,
  token: Token,
  to: string,
  amount: string,
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId)
  const wallet = getEthersWallet(account).connect(provider)
  const contract = new ethers.Contract(token.address, ERC20_ABI, wallet)
  const tx = await contract.transfer!(to, ethers.parseUnits(amount, token.decimals))
  await tx.wait()
  return tx.hash
}

async function sendTronToken(
  account: SecretAccount,
  token: Token,
  to: string,
  amount: string,
): Promise<string> {
  const tronWeb = getTronWeb(account)
  const contract = await tronWeb.contract().at(token.address)
  const rawAmount = BigInt(
    Math.round(Number(amount) * 10 ** token.decimals),
  ).toString()
  const tx = await contract.transfer(to, rawAmount).send()
  return tx
}

export function isDuplicateToken(chainId: string, address: string, tokens: Token[]): boolean {
  const id = tokenId(chainId, address)
  return tokens.some((t) => t.id === id)
}
