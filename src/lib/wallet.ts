import { HDKey } from '@scure/bip32'
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { ethers } from 'ethers'
import { TronWeb } from 'tronweb'

export const EVM_PATH = "m/44'/60'/0'/0"
export const TRON_PATH = "m/44'/195'/0'/0"

export interface PublicAccount {
  index: number
  evmAddress: string
  tronAddress: string
}

export interface SecretAccount extends PublicAccount {
  evmPrivateKey: string
  tronPrivateKey: string
}

/** @deprecated Use SecretAccount — kept for internal lib compatibility */
export type DerivedAccount = SecretAccount

export function toPublicAccount(account: SecretAccount): PublicAccount {
  return {
    index: account.index,
    evmAddress: account.evmAddress,
    tronAddress: account.tronAddress,
  }
}

export function wipeSecretAccount(account: SecretAccount): void {
  account.evmPrivateKey = '\0'.repeat(Math.min(account.evmPrivateKey.length, 66))
  account.tronPrivateKey = '\0'.repeat(Math.min(account.tronPrivateKey.length, 64))
}

export function normalizeMnemonic(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getWordCount(mnemonic: string): number {
  const words = normalizeMnemonic(mnemonic).split(' ').filter(Boolean)
  return words.length
}

export function isValidMnemonic(mnemonic: string): boolean {
  const normalized = normalizeMnemonic(mnemonic)
  const words = normalized.split(' ').filter(Boolean)
  if (words.length !== 12 && words.length !== 24) return false
  return validateMnemonic(normalized, wordlist)
}

function derivePrivateKey(mnemonic: string, path: string): Uint8Array {
  const seed = mnemonicToSeedSync(normalizeMnemonic(mnemonic))
  const hdKey = HDKey.fromMasterSeed(seed)
  const child = hdKey.derive(path)
  if (!child.privateKey) {
    throw new Error('کلید خصوصی استخراج نشد')
  }
  return child.privateKey
}

export function deriveAccount(mnemonic: string, index = 0): SecretAccount {
  const evmKey = derivePrivateKey(mnemonic, `${EVM_PATH}/${index}`)
  const tronKey = derivePrivateKey(mnemonic, `${TRON_PATH}/${index}`)

  const evmPrivateKey = '0x' + Buffer.from(evmKey).toString('hex')
  const evmWallet = new ethers.Wallet(evmPrivateKey)

  const tronPrivateKey = Buffer.from(tronKey).toString('hex')
  const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' })
  const tronAddress = tronWeb.address.fromPrivateKey(tronPrivateKey)

  if (!tronAddress) {
    throw new Error('آدرس TRON ساخته نشد')
  }

  return {
    index,
    evmAddress: evmWallet.address,
    evmPrivateKey,
    tronAddress,
    tronPrivateKey,
  }
}

export function getEthersWallet(account: Pick<SecretAccount, 'evmPrivateKey'>): ethers.Wallet {
  return new ethers.Wallet(account.evmPrivateKey)
}

export function getTronWeb(account: Pick<SecretAccount, 'tronPrivateKey'>): TronWeb {
  return new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: account.tronPrivateKey,
  })
}

export function getReadOnlyTronWeb(): TronWeb {
  return new TronWeb({ fullHost: 'https://api.trongrid.io' })
}
