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

function tokenizeMnemonicInput(input: string): string[] {
  const text = input
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase()
    // "1. word" یا "1) word" — شماره‌گذاری خط را حذف کن
    .replace(/(?:^|[\s,،;|/\\]+)\d+[.)]\s*/g, ' ')
    .replace(/[,،;|/\\]+/g, ' ')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()

  return text.split(' ').filter(Boolean)
}

export function normalizeMnemonic(input: string): string {
  return tokenizeMnemonicInput(input).join(' ')
}

export function getWordCount(mnemonic: string): number {
  return tokenizeMnemonicInput(mnemonic).length
}

export const VALID_MNEMONIC_LENGTHS = [12, 15, 18, 21, 24] as const

export function isValidMnemonicLength(count: number): boolean {
  return (VALID_MNEMONIC_LENGTHS as readonly number[]).includes(count)
}

export function isValidMnemonic(mnemonic: string): boolean {
  const words = tokenizeMnemonicInput(mnemonic)
  if (!isValidMnemonicLength(words.length)) return false
  return validateMnemonic(words.join(' '), wordlist)
}

export interface ParsedMnemonic {
  mnemonic: string
  passphrase: string
}

export type MnemonicInputIssue =
  | { kind: 'empty' }
  | { kind: 'invalid-count'; count: number }
  | { kind: 'invalid-word'; word: string; index: number }
  | { kind: 'invalid-checksum' }

const SUBMITTABLE_WORD_COUNTS = [
  ...VALID_MNEMONIC_LENGTHS,
  ...VALID_MNEMONIC_LENGTHS.map((n) => n + 1),
] as const

export function canSubmitMnemonicInput(input: string, explicitPassphrase: string): boolean {
  const count = getWordCount(input)
  const pass = explicitPassphrase.trim()

  if (count === 0 && !pass) return false

  if ((SUBMITTABLE_WORD_COUNTS as readonly number[]).includes(count)) {
    return true
  }

  if (pass && isValidMnemonicLength(count)) {
    return true
  }

  return false
}

export function getSubmitBlockReason(
  input: string,
  explicitPassphrase: string,
): string | null {
  if (canSubmitMnemonicInput(input, explicitPassphrase)) return null

  const count = getWordCount(input)
  const pass = explicitPassphrase.trim()

  if (count === 0 && !pass) {
    return 'عبارت بازیابی را وارد کنید.'
  }

  if (pass && !isValidMnemonicLength(count)) {
    return `در فیلد اول ${count} کلمه است — با passphrase باید دقیقاً ۱۲، ۱۵، ۱۸، ۲۱ یا ۲۴ کلمه باشد (کلمه ۲۵ فقط در فیلد passphrase).`
  }

  return `تعداد ${count} کلمه شناسایی شد — باید ۱۲، ۱۵، ۱۸، ۲۱، ۲۴ یا ۲۵ (همه در یک فیلد) باشد.`
}

function findInvalidWord(words: string[], checkAll: boolean, mnemonicLen?: number): number {
  const limit = checkAll ? words.length : (mnemonicLen ?? words.length)
  for (let i = 0; i < limit; i++) {
    if (!wordlist.includes(words[i]!)) return i
  }
  return -1
}

export function getMnemonicInputIssue(
  input: string,
  explicitPassphrase: string,
): MnemonicInputIssue | null {
  const words = tokenizeMnemonicInput(input)
  const normalized = words.join(' ')
  const pass = explicitPassphrase.trim()

  if (words.length === 0) return { kind: 'empty' }

  if (pass) {
    if (!isValidMnemonicLength(words.length)) {
      return { kind: 'invalid-count', count: words.length }
    }
    const bad = findInvalidWord(words, true)
    if (bad >= 0) {
      return { kind: 'invalid-word', word: words[bad]!, index: bad + 1 }
    }
    if (!validateMnemonic(normalized, wordlist)) {
      return { kind: 'invalid-checksum' }
    }
    return null
  }

  for (const len of VALID_MNEMONIC_LENGTHS) {
    if (words.length === len + 1) {
      const bad = findInvalidWord(words, false, len)
      if (bad >= 0) {
        return { kind: 'invalid-word', word: words[bad]!, index: bad + 1 }
      }
      const mnemonic = words.slice(0, len).join(' ')
      if (!validateMnemonic(mnemonic, wordlist)) {
        return { kind: 'invalid-checksum' }
      }
      return null
    }
  }

  if (!isValidMnemonicLength(words.length)) {
    return { kind: 'invalid-count', count: words.length }
  }

  const bad = findInvalidWord(words, true)
  if (bad >= 0) {
    return { kind: 'invalid-word', word: words[bad]!, index: bad + 1 }
  }
  if (!validateMnemonic(normalized, wordlist)) {
    return { kind: 'invalid-checksum' }
  }
  return null
}

export function formatMnemonicInputIssue(issue: MnemonicInputIssue): string {
  switch (issue.kind) {
    case 'empty':
      return 'عبارت بازیابی را وارد کنید.'
    case 'invalid-count':
      return `تعداد کلمات (${issue.count}) نامعتبر است. باید ۱۲، ۱۵، ۱۸، ۲۱ یا ۲۴ کلمه باشد.`
    case 'invalid-word':
      return `کلمه ${issue.index} («${issue.word}») در لیست BIP39 انگلیسی نیست — املا یا فاصله را بررسی کنید.`
    case 'invalid-checksum':
      return 'checksum نامعتبر است — یکی از کلمات جابه‌جا یا اشتباه تایپ شده.'
  }
}

/** 24 کلمه + passphrase جدا (Ledger) یا N+1 کلمه در یک فیلد */
export function parseMnemonicInput(
  input: string,
  explicitPassphrase: string,
): ParsedMnemonic | null {
  const words = tokenizeMnemonicInput(input)
  const normalized = words.join(' ')
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
