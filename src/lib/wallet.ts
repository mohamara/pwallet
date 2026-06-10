import { HDKey } from '@scure/bip32'
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { ethers } from 'ethers'
import { TronWeb } from 'tronweb'
import {
  buildDerivationPathFromConfig,
  normalizeDerivationConfig,
  repairDerivationCandidates,
  resolveDefaultDerivationConfig,
  type DerivationConfig,
  type DerivationLayout,
} from './derivation'

export type {
  DerivationConfig,
  DerivationLayout,
  DerivationStandard,
} from './derivation'
export {
  DERIVATION_STANDARDS,
  STANDARD_META,
  buildDerivationPathFromConfig,
  commonRepairDerivationConfigs,
  formatDerivationLayout,
  formatDerivationStandard,
  isValidDerivationPath,
  normalizeDerivationConfig,
  repairDerivationCandidates,
  resolveDefaultDerivationConfig,
  validateDerivationConfig,
} from './derivation'

export const EVM_PATH = "m/44'/60'/0'/0"
export const TRON_PATH = "m/44'/195'/0'/0"

/** Ledger Live: account در سطح سوم (m/44'/coin'/account'/0/0) */
export const LEDGER_EVM_PATH = "m/44'/60'"
export const LEDGER_TRON_PATH = "m/44'/195'"

/** @deprecated از DerivationConfig.layout استفاده کنید */
export type DerivationProfile = DerivationLayout

/** @deprecated از resolveDefaultDerivationConfig استفاده کنید */
export function resolveDerivationProfile(
  mnemonic: string,
  passphrase: string,
): DerivationProfile {
  return resolveDefaultDerivationConfig(getWordCount(mnemonic), Boolean(passphrase.trim()))
    .layout
}

/** @deprecated از buildDerivationPathFromConfig استفاده کنید */
export function buildDerivationPath(
  profile: DerivationProfile,
  chain: 'evm' | 'tron',
  index: number,
): string {
  return buildDerivationPathFromConfig(
    normalizeDerivationConfig({
      standard: 'bip44',
      layout: profile,
      accountIndex: profile === 'ledger' ? index : 0,
      changeIndex: 0,
      addressIndex: profile === 'ledger' ? 0 : index,
    }),
    chain,
  )
}

export interface PublicAccount {
  evmAddress: string
  tronAddress: string
  derivationConfig: DerivationConfig
  evmDerivationPath: string
  tronDerivationPath: string
  /** @deprecated از derivationConfig.layout استفاده کنید */
  derivationProfile: DerivationProfile
  /** @deprecated از derivationConfig.accountIndex / addressIndex استفاده کنید */
  index: number
}

export interface SecretAccount extends PublicAccount {
  evmPrivateKey: string
  tronPrivateKey: string
}

/** @deprecated Use SecretAccount — kept for internal lib compatibility */
export type DerivedAccount = SecretAccount

export function toPublicAccount(account: SecretAccount): PublicAccount {
  return {
    evmAddress: account.evmAddress,
    tronAddress: account.tronAddress,
    derivationConfig: account.derivationConfig,
    evmDerivationPath: account.evmDerivationPath,
    tronDerivationPath: account.tronDerivationPath,
    derivationProfile: account.derivationConfig.layout,
    index:
      account.derivationConfig.layout === 'ledger'
        ? account.derivationConfig.accountIndex
        : account.derivationConfig.addressIndex,
  }
}

export function wipeSecretAccount(account: SecretAccount): void {
  account.evmPrivateKey = '\0'.repeat(Math.min(account.evmPrivateKey.length, 66))
  account.tronPrivateKey = '\0'.repeat(Math.min(account.tronPrivateKey.length, 64))
}

function tokenizeMnemonicInputRaw(input: string): string[] {
  const text = input
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/(?:^|[\s,،;|/\\]+)\d+[.)]\s*/gi, ' ')
    .replace(/[,،;|/\\]+/g, ' ')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()

  return text.split(' ').filter(Boolean)
}

function tokenizeMnemonicInput(input: string): string[] {
  return tokenizeMnemonicInputRaw(input).map((w) => w.toLowerCase())
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

export interface MnemonicSwapFix {
  indexA: number
  indexB: number
  wordA: string
  wordB: string
}

export interface MnemonicRepairResult {
  mnemonic: string
  passphrase: string
  swaps: MnemonicSwapFix[]
  alternateCandidates: number
}

export type RepairCheckStatus = 'pending' | 'running' | 'ok' | 'fail' | 'skip'

export interface RepairCheckStep {
  id: string
  label: string
  detail?: string
  status: RepairCheckStatus
}

export type RepairTargetChain = 'evm' | 'tron'

export interface RepairTargetAddress {
  chain: RepairTargetChain
  address: string
}

export interface RepairCandidateView {
  id: string
  swaps: MnemonicSwapFix[]
  score: number
  selected: boolean
  mnemonic: string
  addressMatch?: boolean
}

export interface MnemonicRepairAnalysis {
  steps: RepairCheckStep[]
  result: MnemonicRepairResult | null
  candidates: RepairCandidateView[]
  pairChecks: number
}

function swapWords(words: string[], i: number, j: number): string[] {
  const next = [...words]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function wordlistIndex(word: string): number {
  return wordlist.indexOf(word)
}

function swapLikelihood(fix: MnemonicSwapFix, words: string[]): number {
  const gap = fix.indexB - fix.indexA
  const wordGap = Math.abs(wordlistIndex(words[fix.indexA]!) - wordlistIndex(words[fix.indexB]!))
  let score = 0

  if (gap === 1) score += 4000
  if (gap >= 4 && gap <= 12) score += 2500
  if (fix.indexA === words.length - 1 || fix.indexB === words.length - 1) score += 2000

  score -= Math.min(wordGap, 500)
  score -= gap * 10
  score -= fix.indexA

  return score
}

function rankSwapFixes(
  fixes: MnemonicSwapFix[],
  words: string[],
): Array<{ fix: MnemonicSwapFix; score: number }> {
  return fixes
    .map((fix) => ({ fix, score: swapLikelihood(fix, words) }))
    .sort((a, b) => b.score - a.score || a.fix.indexA - b.fix.indexA)
}

function pairCount(wordCount: number): number {
  return (wordCount * (wordCount - 1)) / 2
}

const REPAIR_YIELD_EVERY = 16
const DOUBLE_SWAP_YIELD_EVERY = 64
const MAX_REPAIR_CANDIDATES = 8

export interface AnalyzeMnemonicRepairOptions {
  allowDoubleSwap?: boolean
  targetAddress?: RepairTargetAddress | null
  isCancelled?: () => boolean
  onUpdate?: (analysis: MnemonicRepairAnalysis) => void
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/

export function parseRepairTargetAddress(input: string): RepairTargetAddress | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (EVM_ADDRESS_RE.test(trimmed)) {
    try {
      return { chain: 'evm', address: ethers.getAddress(trimmed) }
    } catch {
      return null
    }
  }

  if (TRON_ADDRESS_RE.test(trimmed) && TronWeb.isAddress(trimmed)) {
    return { chain: 'tron', address: trimmed }
  }

  return null
}

export function formatRepairTargetAddress(target: RepairTargetAddress): string {
  return target.chain === 'evm' ? `EVM ${target.address}` : `TRON ${target.address}`
}

function compareRepairAddress(derived: string, target: RepairTargetAddress): boolean {
  if (target.chain === 'evm') {
    return derived.toLowerCase() === target.address.toLowerCase()
  }
  return derived === target.address
}

export function matchesRepairTargetAddress(
  mnemonic: string,
  passphrase: string,
  target: RepairTargetAddress,
  derivationConfig = resolveDefaultDerivationConfig(
    getWordCount(mnemonic),
    Boolean(passphrase.trim()),
  ),
): boolean {
  for (const config of repairDerivationCandidates(derivationConfig)) {
    try {
      const account = deriveAccount(mnemonic, passphrase, config)
      const derived = target.chain === 'evm' ? account.evmAddress : account.tronAddress
      if (compareRepairAddress(derived, target)) return true
    } catch {
      // try next config
    }
  }
  return false
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function isCancelled(options?: AnalyzeMnemonicRepairOptions): boolean {
  return options?.isCancelled?.() ?? false
}

async function findSingleSwapFixesAsync(
  mnemonicWords: string[],
  options?: AnalyzeMnemonicRepairOptions,
  onPairProgress?: (checked: number, total: number) => void,
): Promise<MnemonicSwapFix[]> {
  const fixes: MnemonicSwapFix[] = []
  const n = mnemonicWords.length
  const total = pairCount(n)
  let checked = 0

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (isCancelled(options)) return fixes

      checked++
      const swapped = swapWords(mnemonicWords, i, j)
      if (validateMnemonic(swapped.join(' '), wordlist)) {
        fixes.push({
          indexA: i,
          indexB: j,
          wordA: mnemonicWords[i]!,
          wordB: mnemonicWords[j]!,
        })
      }

      if (checked % REPAIR_YIELD_EVERY === 0) {
        onPairProgress?.(checked, total)
        await yieldToMain()
      }
    }
  }

  onPairProgress?.(total, total)
  return fixes
}

async function findBestDoubleSwapFixAsync(
  mnemonicWords: string[],
  options?: AnalyzeMnemonicRepairOptions,
  passphrase = '',
): Promise<MnemonicSwapFix[] | null> {
  const n = mnemonicWords.length
  const targetAddress = options?.targetAddress ?? null
  let best: { swaps: MnemonicSwapFix[]; score: number } | null = null
  let addressMatch: MnemonicSwapFix[] | null = null
  let iterations = 0

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (isCancelled(options)) return addressMatch ?? best?.swaps ?? null

      const once = swapWords(mnemonicWords, i, j)
      if (validateMnemonic(once.join(' '), wordlist)) continue

      for (let k = 0; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          if (isCancelled(options)) return addressMatch ?? best?.swaps ?? null
          if (i === k && j === l) continue

          iterations++
          const twice = swapWords(once, k, l)
          if (!validateMnemonic(twice.join(' '), wordlist)) continue

          const swaps: MnemonicSwapFix[] = [
            {
              indexA: i,
              indexB: j,
              wordA: mnemonicWords[i]!,
              wordB: mnemonicWords[j]!,
            },
            {
              indexA: k,
              indexB: l,
              wordA: once[k]!,
              wordB: once[l]!,
            },
          ]

          if (
            targetAddress &&
            filterDoubleFixesByTargetAddress(mnemonicWords, swaps, passphrase, targetAddress)
          ) {
            addressMatch = swaps
            return addressMatch
          }

          const gapScore = (fix: MnemonicSwapFix) => swapLikelihood(fix, mnemonicWords)
          const score = gapScore(swaps[0]!) + gapScore(swaps[1]!)
          if (!best || score > best.score) {
            best = { swaps, score }
          }

          if (iterations % DOUBLE_SWAP_YIELD_EVERY === 0) {
            await yieldToMain()
          }
        }
      }
    }
  }

  return addressMatch ?? best?.swaps ?? null
}

function swapFixId(swaps: MnemonicSwapFix[]): string {
  return swaps.map((fix) => `${fix.indexA}:${fix.indexB}`).join('|')
}

function filterFixesByTargetAddress(
  mnemonicWords: string[],
  fixes: MnemonicSwapFix[],
  passphrase: string,
  targetAddress: RepairTargetAddress,
): MnemonicSwapFix[] {
  return fixes.filter((fix) => {
    const mnemonic = applySwapFixes(mnemonicWords, [fix]).join(' ')
    return matchesRepairTargetAddress(mnemonic, passphrase, targetAddress)
  })
}

function filterDoubleFixesByTargetAddress(
  mnemonicWords: string[],
  swaps: MnemonicSwapFix[],
  passphrase: string,
  targetAddress: RepairTargetAddress,
): boolean {
  const mnemonic = applySwapFixes(mnemonicWords, swaps).join(' ')
  return matchesRepairTargetAddress(mnemonic, passphrase, targetAddress)
}

function buildRepairCandidates(
  mnemonicWords: string[],
  ranked: Array<{ fix: MnemonicSwapFix; score: number }>,
  repairSwaps: MnemonicSwapFix[],
  passphrase: string,
  targetAddress?: RepairTargetAddress | null,
): RepairCandidateView[] {
  const selectedId = swapFixId(repairSwaps)
  const seen = new Set<string>()
  const candidates: RepairCandidateView[] = []

  const pushCandidate = (
    swaps: MnemonicSwapFix[],
    score: number,
    selected: boolean,
    addressMatch?: boolean,
  ) => {
    const id = swapFixId(swaps)
    if (seen.has(id)) {
      if (selected) {
        const existing = candidates.find((candidate) => candidate.id === id)
        if (existing) existing.selected = true
      }
      if (addressMatch) {
        const existing = candidates.find((candidate) => candidate.id === id)
        if (existing) existing.addressMatch = true
      }
      return
    }
    seen.add(id)
    candidates.push({
      id,
      swaps,
      score,
      selected,
      mnemonic: applySwapFixes(mnemonicWords, swaps).join(' '),
      addressMatch,
    })
  }

  const source =
    targetAddress != null
      ? ranked
      : ranked.slice(0, MAX_REPAIR_CANDIDATES)

  for (const { fix, score } of source) {
    const mnemonic = applySwapFixes(mnemonicWords, [fix]).join(' ')
    const addressMatch = targetAddress
      ? matchesRepairTargetAddress(mnemonic, passphrase, targetAddress)
      : undefined
    if (targetAddress && !addressMatch) continue
    pushCandidate([fix], score, selectedId === swapFixId([fix]), addressMatch)
  }

  if (repairSwaps.length === 2) {
    const score =
      swapLikelihood(repairSwaps[0]!, mnemonicWords) +
      swapLikelihood(repairSwaps[1]!, mnemonicWords)
    const mnemonic = applySwapFixes(mnemonicWords, repairSwaps).join(' ')
    const addressMatch = targetAddress
      ? matchesRepairTargetAddress(mnemonic, passphrase, targetAddress)
      : undefined
    if (!targetAddress || addressMatch) {
      pushCandidate(repairSwaps, score, true, addressMatch)
    }
  }

  candidates.sort((a, b) => {
    if (targetAddress) {
      if (a.addressMatch !== b.addressMatch) return a.addressMatch ? -1 : 1
    }
    if (a.selected !== b.selected) return a.selected ? -1 : 1
    return b.score - a.score
  })

  return candidates
}

export function repairResultFromCandidate(
  candidate: RepairCandidateView,
  passphrase: string,
  alternateCandidates: number,
): MnemonicRepairResult {
  return {
    mnemonic: candidate.mnemonic,
    passphrase,
    swaps: candidate.swaps,
    alternateCandidates,
  }
}

function emitRepairUpdate(
  analysis: MnemonicRepairAnalysis,
  options?: AnalyzeMnemonicRepairOptions,
): void {
  options?.onUpdate?.(analysis)
}

/** گزارش گام‌به‌گام بررسی و اصلاح — async با yield برای جلوگیری از فریز مرورگر */
export async function analyzeMnemonicRepairAsync(
  input: string,
  explicitPassphrase: string,
  options: AnalyzeMnemonicRepairOptions = {},
): Promise<MnemonicRepairAnalysis | null> {
  const steps: RepairCheckStep[] = []
  const words = tokenizeMnemonicInput(input)
  const pass = explicitPassphrase.trim()

  steps.push({
    id: 'tokenize',
    label: 'خواندن و نرمال‌سازی کلمات',
    detail: words.length > 0 ? `${words.length} کلمه شناسایی شد` : 'ورودی خالی',
    status: words.length > 0 ? 'ok' : 'fail',
  })

  if (words.length === 0) {
    const empty = { steps, result: null, candidates: [], pairChecks: 0 }
    emitRepairUpdate(empty, options)
    return empty
  }

  const resolved = resolveMnemonicWords(input, explicitPassphrase)
  if (!resolved) {
    steps.push({
      id: 'structure',
      label: 'بررسی ساختار عبارت',
      detail: pass
        ? 'تعداد کلمات یا لیست BIP39 نامعتبر است'
        : 'تعداد کلمات باید ۱۲، ۱۵، ۱۸، ۲۱، ۲۴ یا ۲۵ باشد',
      status: 'fail',
    })
    const failed = { steps, result: null, candidates: [], pairChecks: 0 }
    emitRepairUpdate(failed, options)
    return failed
  }

  const { mnemonicWords, passphrase } = resolved
  const mnemonicLen = mnemonicWords.length

  steps.push({
    id: 'structure',
    label: 'بررسی ساختار عبارت',
    detail: pass
      ? `${mnemonicLen} کلمه mnemonic + passphrase جدا`
      : passphrase
        ? `${mnemonicLen} کلمه mnemonic + ۱ کلمه passphrase در همان فیلد`
        : `${mnemonicLen} کلمه mnemonic`,
    status: 'ok',
  })

  const bad = findInvalidWord(mnemonicWords, true)
  steps.push({
    id: 'wordlist',
    label: 'بررسی لیست BIP39 انگلیسی',
    detail:
      bad >= 0
        ? `کلمه ${bad + 1} («${mnemonicWords[bad]}») در wordlist نیست`
        : `هر ${mnemonicLen} کلمه در wordlist یافت شد`,
    status: bad >= 0 ? 'fail' : 'ok',
  })

  if (bad >= 0) {
    const failed = { steps, result: null, candidates: [], pairChecks: 0 }
    emitRepairUpdate(failed, options)
    return failed
  }

  const checksumOk = validateMnemonic(mnemonicWords.join(' '), wordlist)
  steps.push({
    id: 'checksum',
    label: 'بررسی checksum BIP39',
    detail: checksumOk ? 'checksum معتبر است' : 'checksum نامعتبر — احتمال جابجایی کلمات',
    status: checksumOk ? 'ok' : 'fail',
  })

  if (checksumOk) {
    const ok = { steps, result: null, candidates: [], pairChecks: 0 }
    emitRepairUpdate(ok, options)
    return ok
  }

  await yieldToMain()
  if (isCancelled(options)) return null

  const totalPairs = pairCount(mnemonicLen)
  steps.push({
    id: 'single-scan',
    label: 'جستجوی جابجایی تک‌کلمه‌ای',
    detail: `در حال بررسی ${totalPairs} جفت…`,
    status: 'running',
  })
  emitRepairUpdate({ steps: [...steps], result: null, candidates: [], pairChecks: 0 }, options)

  const singleFixes = await findSingleSwapFixesAsync(
    mnemonicWords,
    options,
    (checked, total) => {
      steps[steps.length - 1] = {
        id: 'single-scan',
        label: 'جستجوی جابجایی تک‌کلمه‌ای',
        detail: `بررسی ${checked} از ${total} جفت…`,
        status: 'running',
      }
      emitRepairUpdate({ steps: [...steps], result: null, candidates: [], pairChecks: checked }, options)
    },
  )

  const ranked = rankSwapFixes(singleFixes, mnemonicWords)
  const targetAddress = options.targetAddress ?? null
  let addressMatchedFixes =
    targetAddress != null
      ? filterFixesByTargetAddress(mnemonicWords, singleFixes, passphrase, targetAddress)
      : []
  const rankedAddressMatches =
    targetAddress != null ? rankSwapFixes(addressMatchedFixes, mnemonicWords) : []
  const bestSingle = targetAddress
    ? rankedAddressMatches[0]?.fix ?? null
    : ranked[0]?.fix ?? null

  steps[steps.length - 1] = {
    id: 'single-scan',
    label: 'جستجوی جابجایی تک‌کلمه‌ای',
    detail:
      singleFixes.length > 0
        ? targetAddress
          ? `${totalPairs} جفت بررسی شد — ${singleFixes.length} حالت معتبر، ${addressMatchedFixes.length} با آدرس شما`
          : `${totalPairs} جفت بررسی شد — ${singleFixes.length} حالت معتبر پیدا شد`
        : `${totalPairs} جفت بررسی شد — هیچ حالت تک‌جابجایی معتبر نبود`,
    status:
      singleFixes.length > 0
        ? targetAddress && addressMatchedFixes.length === 0
          ? 'fail'
          : 'ok'
        : 'fail',
  }

  let repairSwaps: MnemonicSwapFix[] | null = bestSingle ? [bestSingle] : null
  let alternateCandidates = targetAddress
    ? addressMatchedFixes.length
    : singleFixes.length
  let pairChecks = totalPairs

  if (targetAddress && addressMatchedFixes.length === 0 && options.allowDoubleSwap) {
    steps.push({
      id: 'double-scan',
      label: 'جستجوی دو جابجایی پشت‌سرهم',
      detail: 'هیچ swap تکی با آدرس شما نبود — در حال جستجوی دو swap…',
      status: 'running',
    })
    emitRepairUpdate({ steps: [...steps], result: null, candidates: [], pairChecks }, options)

    repairSwaps = await findBestDoubleSwapFixAsync(mnemonicWords, options, passphrase)
    alternateCandidates = repairSwaps ? 1 : 0
    pairChecks += totalPairs * totalPairs

    steps[steps.length - 1] = {
      id: 'double-scan',
      label: 'جستجوی دو جابجایی پشت‌سرهم',
      detail: repairSwaps
        ? 'ترکیب دو swap با آدرس شما پیدا شد'
        : 'هیچ ترکیب swap با این آدرس پیدا نشد',
      status: repairSwaps ? 'ok' : 'fail',
    }
  } else if (!repairSwaps && options.allowDoubleSwap) {
    steps.push({
      id: 'double-scan',
      label: 'جستجوی دو جابجایی پشت‌سرهم',
      detail: 'در حال امتحان ترکیب دو swap…',
      status: 'running',
    })
    emitRepairUpdate({ steps: [...steps], result: null, candidates: [], pairChecks }, options)

    repairSwaps = await findBestDoubleSwapFixAsync(mnemonicWords, options, passphrase)
    alternateCandidates = repairSwaps ? 1 : 0
    pairChecks += totalPairs * totalPairs

    steps[steps.length - 1] = {
      id: 'double-scan',
      label: 'جستجوی دو جابجایی پشت‌سرهم',
      detail: repairSwaps
        ? 'ترکیب دو swap معتبر پیدا شد'
        : 'هیچ ترکیب دو swap معتبر نبود',
      status: repairSwaps ? 'ok' : 'fail',
    }
  } else if (!repairSwaps && !options.allowDoubleSwap) {
    steps.push({
      id: 'double-scan',
      label: 'جستجوی دو جابجایی',
      detail: 'فقط هنگام باز کردن کیف پول اجرا می‌شود',
      status: 'skip',
    })
  }

  if (targetAddress) {
    const matchedMnemonic = repairSwaps
      ? applySwapFixes(mnemonicWords, repairSwaps).join(' ')
      : null
    const addressOk =
      matchedMnemonic != null &&
      matchesRepairTargetAddress(matchedMnemonic, passphrase, targetAddress)

    steps.push({
      id: 'address-check',
      label: 'تطبیق با آدرس شناخته‌شده',
      detail: addressOk
        ? `${formatRepairTargetAddress(targetAddress)} — ترتیب درست پیدا شد`
        : repairSwaps
          ? `${formatRepairTargetAddress(targetAddress)} — هیچ چینشی با این آدرس مطابقت نکرد`
          : `${formatRepairTargetAddress(targetAddress)} — در انتظار اصلاح…`,
      status: addressOk ? 'ok' : repairSwaps ? 'fail' : 'skip',
    })

    if (repairSwaps && !addressOk) {
      const failed = {
        steps,
        result: null,
        candidates: buildRepairCandidates(
          mnemonicWords,
          ranked,
          repairSwaps,
          passphrase,
          targetAddress,
        ),
        pairChecks,
      }
      emitRepairUpdate(failed, options)
      return failed
    }
  }

  if (!repairSwaps) {
    steps.push({
      id: 'rank',
      label: 'انتخاب بهترین حالت',
      detail: options.allowDoubleSwap
        ? 'اصلاح خودکار ممکن نیست'
        : 'با «باز کردن کیف پول» جستجوی عمیق‌تر انجام می‌شود',
      status: 'fail',
    })
    const failed = { steps, result: null, candidates: [], pairChecks }
    emitRepairUpdate(failed, options)
    return failed
  }

  const candidates = buildRepairCandidates(
    mnemonicWords,
    targetAddress ? rankedAddressMatches : ranked,
    repairSwaps,
    passphrase,
    targetAddress,
  )

  steps.push({
    id: 'rank',
    label: 'رتبه‌بندی حالت‌های معتبر',
    detail: targetAddress
      ? candidates.length > 1
        ? `${candidates.length} چینش با آدرس شما — یکی را انتخاب کنید`
        : candidates.length === 1
          ? 'تنها یک چینش با آدرس شما'
          : 'هیچ چینشی با آدرس شما پیدا نشد'
      : alternateCandidates > 1
        ? `${alternateCandidates} حالت — یکی را از لیست پایین انتخاب کنید`
        : 'تنها یک حالت معتبر',
    status: candidates.length > 0 || !targetAddress ? 'ok' : 'fail',
  })

  const result: MnemonicRepairResult = {
    mnemonic: applySwapFixes(mnemonicWords, repairSwaps).join(' '),
    passphrase,
    swaps: repairSwaps,
    alternateCandidates,
  }

  steps.push({
    id: 'apply',
    label: 'اعمال اصلاح انتخاب‌شده',
    detail: formatMnemonicRepair(result),
    status: 'ok',
  })

  const finalAnalysis = { steps, result, candidates, pairChecks }
  emitRepairUpdate(finalAnalysis, options)
  return finalAnalysis
}

/** @deprecated از analyzeMnemonicRepairAsync استفاده کنید */
export function analyzeMnemonicRepair(
  input: string,
  explicitPassphrase: string,
): MnemonicRepairAnalysis | null {
  const words = tokenizeMnemonicInput(input)
  if (words.length === 0) return null
  const resolved = resolveMnemonicWords(input, explicitPassphrase)
  if (!resolved) return null
  if (validateMnemonic(resolved.mnemonicWords.join(' '), wordlist)) return null

  const singleFixes = findSingleSwapFixesSync(resolved.mnemonicWords)
  const ranked = rankSwapFixes(singleFixes, resolved.mnemonicWords)
  const bestSingle = ranked[0]?.fix
  if (!bestSingle) return null

  const repairSwaps = [bestSingle]
  const result: MnemonicRepairResult = {
    mnemonic: applySwapFixes(resolved.mnemonicWords, repairSwaps).join(' '),
    passphrase: resolved.passphrase,
    swaps: repairSwaps,
    alternateCandidates: singleFixes.length,
  }

  return {
    steps: [],
    result,
    candidates: buildRepairCandidates(
      resolved.mnemonicWords,
      ranked,
      repairSwaps,
      resolved.passphrase,
    ),
    pairChecks: pairCount(resolved.mnemonicWords.length),
  }
}

function findSingleSwapFixesSync(mnemonicWords: string[]): MnemonicSwapFix[] {
  if (validateMnemonic(mnemonicWords.join(' '), wordlist)) return []

  const fixes: MnemonicSwapFix[] = []
  for (let i = 0; i < mnemonicWords.length; i++) {
    for (let j = i + 1; j < mnemonicWords.length; j++) {
      const swapped = swapWords(mnemonicWords, i, j)
      if (validateMnemonic(swapped.join(' '), wordlist)) {
        fixes.push({
          indexA: i,
          indexB: j,
          wordA: mnemonicWords[i]!,
          wordB: mnemonicWords[j]!,
        })
      }
    }
  }
  return fixes
}

function applySwapFixes(mnemonicWords: string[], swaps: MnemonicSwapFix[]): string[] {
  let words = [...mnemonicWords]
  for (const fix of swaps) {
    words = swapWords(words, fix.indexA, fix.indexB)
  }
  return words
}

function resolveMnemonicWords(
  input: string,
  explicitPassphrase: string,
): { mnemonicWords: string[]; passphrase: string } | null {
  const words = tokenizeMnemonicInput(input)
  const pass = explicitPassphrase.trim()

  if (pass) {
    if (!isValidMnemonicLength(words.length)) return null
    if (findInvalidWord(words, true) >= 0) return null
    return { mnemonicWords: words, passphrase: explicitPassphrase }
  }

  for (const len of VALID_MNEMONIC_LENGTHS) {
    if (words.length === len + 1) {
      if (findInvalidWord(words, false, len) >= 0) return null
      const rawWords = tokenizeMnemonicInputRaw(input)
      return {
        mnemonicWords: words.slice(0, len),
        passphrase: rawWords.slice(len).join(' '),
      }
    }
  }

  if (!isValidMnemonicLength(words.length)) return null
  if (findInvalidWord(words, true) >= 0) return null
  return { mnemonicWords: words, passphrase: '' }
}

/** اگر checksum به‌خاطر جابجایی کلمات خراب شده، ترتیب درست را پیدا کن */
export async function tryRepairMnemonicInputAsync(
  input: string,
  explicitPassphrase: string,
  options: AnalyzeMnemonicRepairOptions = {},
): Promise<MnemonicRepairResult | null> {
  const analysis = await analyzeMnemonicRepairAsync(input, explicitPassphrase, {
    allowDoubleSwap: true,
    ...options,
  })
  return analysis?.result ?? null
}

export function formatMnemonicSwapFix(fix: MnemonicSwapFix): string {
  return `کلمه ${fix.indexA + 1} («${fix.wordA}») و کلمه ${fix.indexB + 1} («${fix.wordB}») جابجا می‌شوند`
}

export function formatMnemonicRepair(repair: MnemonicRepairResult): string {
  const swapText = repair.swaps.map(formatMnemonicSwapFix).join(' و ')
  if (repair.alternateCandidates > 1) {
    return `${swapText} (از ${repair.alternateCandidates} حالت معتبر انتخاب شد)`
  }
  return swapText
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
    // passphrase باید عیناً استفاده شود — در BIP39 حتی فاصله ابتدا/انتها seed را عوض می‌کند
    return { mnemonic: normalized, passphrase: explicitPassphrase }
  }

  for (const len of VALID_MNEMONIC_LENGTHS) {
    if (words.length === len + 1) {
      const mnemonic = words.slice(0, len).join(' ')
      if (validateMnemonic(mnemonic, wordlist)) {
        const rawWords = tokenizeMnemonicInputRaw(input)
        const passphrase = rawWords.slice(len).join(' ')
        return { mnemonic, passphrase }
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
  passphrase = '',
  derivationConfig = resolveDefaultDerivationConfig(
    getWordCount(mnemonic),
    Boolean(passphrase.trim()),
  ),
): SecretAccount {
  const config = normalizeDerivationConfig(derivationConfig)
  const evmPath = buildDerivationPathFromConfig(config, 'evm')
  const tronPath = buildDerivationPathFromConfig(config, 'tron')

  const evmKey = derivePrivateKey(mnemonic, evmPath, passphrase)
  const tronKey = derivePrivateKey(mnemonic, tronPath, passphrase)

  const evmPrivateKey = '0x' + Buffer.from(evmKey).toString('hex')
  const evmWallet = new ethers.Wallet(evmPrivateKey)

  const tronPrivateKey = Buffer.from(tronKey).toString('hex')
  const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' })
  const tronAddress = tronWeb.address.fromPrivateKey(tronPrivateKey)

  if (!tronAddress) {
    throw new Error('آدرس TRON ساخته نشد')
  }

  return {
    evmAddress: evmWallet.address,
    evmPrivateKey,
    tronAddress,
    tronPrivateKey,
    derivationConfig: config,
    evmDerivationPath: evmPath,
    tronDerivationPath: tronPath,
    derivationProfile: config.layout,
    index: config.layout === 'ledger' ? config.accountIndex : config.addressIndex,
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
