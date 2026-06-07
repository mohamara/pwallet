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

export const VALID_MNEMONIC_LENGTHS = [12, 15, 18, 21, 24] as const

export function isValidMnemonicLength(count: number): boolean {
  return (VALID_MNEMONIC_LENGTHS as readonly number[]).includes(count)
}

export function isValidMnemonic(mnemonic: string): boolean {
  const normalized = normalizeMnemonic(mnemonic)
  const words = normalized.split(' ').filter(Boolean)
  if (!isValidMnemonicLength(words.length)) return false
  return validateMnemonic(normalized, wordlist)
}

export interface ParsedMnemonic {
  mnemonic: string
  passphrase: string
}

/** 24 کلمه + passphrase جدا (Ledger) یا N+1 کلمه در یک فیلد */
export function parseMnemonicInput(
  input: string,
  explicitPassphrase: string,
): ParsedMnemonic | null {
  const normalized = normalizeMnemonic(input)
  const words = normalized.split(' ').filter(Boolean)
  const pass = explicitPassphrase.trim()

  if (pass) {
    if (!isValidMnemonic(normalized)) return null
    return { mnemonic: normalized, passphrase: pass }
  }

  for (const len of VALID_MNEMONIC_LENGTHS) {
    if (words.length === len + 1) {
      const mnemonic = words.slice(0, len).join(' ')
      if (validateMnemonic(mnemonic, wordlist)) {
        return { mnemonic, passphrase: words.slice(len).join(' ') }
      }
    }
  }

  if (isValidMnemonic(normalized)) {
    return { mnemonic: normalized, passphrase: '' }
  }

  return null
}

function derivePrivateKey(mnemonic: string, path: string, passphrase: string): Uint8Array {
  const seed = mnemonicToSeedSync(normalizeMnemonic(mnemonic), passphrase)
  const hdKey = HDKey.fromMasterSeed(seed)
  const child = hdKey.derive(path)
  if (!child.privateKey) {
    throw new Error('کلید خصوصی استخراج نشد')
  }
  return child.privateKey
}

export function deriveAccount(
  mnemonic: string,
  index = 0,
  passphrase = '',
): SecretAccount {
  const evmKey = derivePrivateKey(mnemonic, `${EVM_PATH}/${index}`, passphrase)
  const tronKey = derivePrivateKey(mnemonic, `${TRON_PATH}/${index}`, passphrase)

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
