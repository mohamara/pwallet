import { useEffect, useMemo, useState } from 'react'
import { assertSecureContext } from '../lib/secureSession'
import { useDebouncedRepairAnalysis } from '../hooks/useDebouncedRepairAnalysis'
import {
  analyzeMnemonicRepairAsync,
  canSubmitMnemonicInput,
  formatMnemonicInputIssue,
  getMnemonicInputIssue,
  getSubmitBlockReason,
  getWordCount,
  matchesRepairTargetAddress,
  parseMnemonicInput,
  parseRepairTargetAddress,
  repairResultFromCandidate,
  type MnemonicRepairAnalysis,
  type RepairCandidateView,
} from '../lib/wallet'
import { MnemonicRepairLog } from './MnemonicRepairLog'

interface UnlockScreenProps {
  onUnlock: (mnemonic: string, passphrase?: string) => void
  secureContextError?: string | null
}

const PASSPHRASE_HINT_COUNTS = [13, 16, 19, 22, 25]

function resolvePassphrase(
  explicitPassphrase: string,
  analysis: MnemonicRepairAnalysis | null,
): string {
  if (explicitPassphrase.trim()) return explicitPassphrase.trim()
  return analysis?.result?.passphrase ?? ''
}

function pickCandidate(
  candidates: RepairCandidateView[],
  selectedCandidateId: string | null,
): RepairCandidateView | null {
  if (candidates.length === 0) return null
  if (selectedCandidateId) {
    const selected = candidates.find((candidate) => candidate.id === selectedCandidateId)
    if (selected) return selected
  }
  return candidates.find((candidate) => candidate.selected) ?? candidates[0] ?? null
}

export function UnlockScreen({ onUnlock, secureContextError }: UnlockScreenProps) {
  const [mnemonic, setMnemonic] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [knownAddress, setKnownAddress] = useState('')
  const [showWords, setShowWords] = useState(false)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [submitAnalysis, setSubmitAnalysis] = useState<MnemonicRepairAnalysis | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const wordCount = getWordCount(mnemonic)

  const canSubmit = useMemo(
    () => canSubmitMnemonicInput(mnemonic, passphrase),
    [mnemonic, passphrase],
  )

  const inputIssue = useMemo(() => {
    if (!canSubmit) return null
    return getMnemonicInputIssue(mnemonic, passphrase)
  }, [canSubmit, mnemonic, passphrase])

  const submitBlockReason = useMemo(
    () => getSubmitBlockReason(mnemonic, passphrase),
    [mnemonic, passphrase],
  )

  const needsRepairPreview = canSubmit && inputIssue?.kind === 'invalid-checksum'
  const { analysis: previewAnalysis, loading: previewLoading, targetAddress } =
    useDebouncedRepairAnalysis(mnemonic, passphrase, knownAddress, needsRepairPreview)

  const knownAddressIssue = useMemo(() => {
    const trimmed = knownAddress.trim()
    if (!trimmed) return null
    return parseRepairTargetAddress(trimmed) ? null : 'آدرس EVM (0x…) یا TRON (T…) نامعتبر است.'
  }, [knownAddress])

  const repairAnalysis = checking ? submitAnalysis : previewAnalysis
  const repairLoading = checking || previewLoading

  useEffect(() => {
    const candidates = repairAnalysis?.candidates ?? []
    if (candidates.length === 0) {
      setSelectedCandidateId(null)
      return
    }

    setSelectedCandidateId((previous) => {
      if (previous && candidates.some((candidate) => candidate.id === previous)) {
        return previous
      }
      const fallback = candidates.find((candidate) => candidate.selected) ?? candidates[0]
      return fallback?.id ?? null
    })
  }, [repairAnalysis])

  const selectedCandidate = useMemo(() => {
    return pickCandidate(repairAnalysis?.candidates ?? [], selectedCandidateId)
  }, [repairAnalysis, selectedCandidateId])

  const parsed = useMemo(() => {
    const direct = parseMnemonicInput(mnemonic, passphrase)
    if (direct) return direct

    if (selectedCandidate) {
      return {
        mnemonic: selectedCandidate.mnemonic,
        passphrase: resolvePassphrase(passphrase, repairAnalysis),
      }
    }

    const repaired = repairAnalysis?.result
    if (repaired) {
      return { mnemonic: repaired.mnemonic, passphrase: repaired.passphrase }
    }

    return null
  }, [mnemonic, passphrase, selectedCandidate, repairAnalysis])

  const hasPassphraseHint =
    !passphrase.trim() && PASSPHRASE_HINT_COUNTS.includes(wordCount)

  async function runSubmitRepair(): Promise<MnemonicRepairAnalysis | null> {
    setChecking(true)
    setSubmitAnalysis(null)

    const analysis = await analyzeMnemonicRepairAsync(mnemonic, passphrase, {
      allowDoubleSwap: true,
      targetAddress,
      onUpdate: (partial) => setSubmitAnalysis(partial),
    })

    setSubmitAnalysis(analysis)
    setChecking(false)
    return analysis
  }

  function repairFromAnalysis(analysis: MnemonicRepairAnalysis | null) {
    if (!analysis) return null

    const candidate = pickCandidate(analysis.candidates, selectedCandidateId)
    if (candidate) {
      return repairResultFromCandidate(
        candidate,
        resolvePassphrase(passphrase, analysis),
        analysis.result?.alternateCandidates ?? analysis.candidates.length,
      )
    }

    return analysis.result
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    try {
      assertSecureContext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'محیط امن نیست')
      return
    }

    let result = parseMnemonicInput(mnemonic, passphrase)
    let needsRepair = false

    if (!result && inputIssue?.kind === 'invalid-checksum') {
      let analysis = submitAnalysis ?? previewAnalysis

      if (!submitAnalysis) {
        analysis = await runSubmitRepair()
      }

      const repair = repairFromAnalysis(analysis)
      if (repair) {
        result = { mnemonic: repair.mnemonic, passphrase: repair.passphrase }
        needsRepair = true
      }
    }

    if (!result) {
      const issue = getMnemonicInputIssue(mnemonic, passphrase)
      setError(
        issue
          ? formatMnemonicInputIssue(issue)
          : targetAddress
            ? 'هیچ چینش کلماتی با این آدرس پیدا نشد — passphrase یا آدرس را بررسی کنید.'
            : 'عبارت بازیابی نامعتبر است. برای Ledger: ۲۴ کلمه + passphrase (کلمه ۲۵) در فیلد جدا.',
      )
      setSubmitAnalysis(null)
      return
    }

    if (targetAddress && !matchesRepairTargetAddress(result.mnemonic, result.passphrase, targetAddress)) {
      setError('آدرس استخراج‌شده با آدرس واردشده مطابقت ندارد.')
      return
    }

    if (needsRepair) {
      setMnemonic(result.mnemonic)
    }

    onUnlock(result.mnemonic, result.passphrase)
    setMnemonic('')
    setPassphrase('')
    setKnownAddress('')
    setShowWords(false)
    setShowPassphrase(false)
    setSubmitAnalysis(null)
    setSelectedCandidateId(null)
  }

  return (
    <div className="unlock-screen">
      <div className="unlock-card">
        <div className="logo-mark">P</div>
        <h1>باز کردن کیف پول</h1>
        <p className="subtitle">
          عبارت بازیابی BIP39 (۱۲ یا ۲۴ کلمه برای Ledger) را وارد کنید. اگر
          passphrase (کلمه ۲۵) دارید، در فیلد جدا وارد کنید.
        </p>

        {secureContextError && (
          <div className="security-banner danger" role="alert">
            {secureContextError}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="input-group">
            <label htmlFor="mnemonic">
              عبارت بازیابی
              <span className={`word-badge ${parsed ? 'valid' : ''}`}>
                {wordCount} کلمه
                {parsed?.passphrase && !passphrase.trim() ? ' + passphrase' : ''}
              </span>
            </label>
            <div className="textarea-wrap">
              <textarea
                id="mnemonic"
                name="pwallet-seed-phrase"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="word1 word2 ... word24"
                rows={4}
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                className={showWords ? '' : 'masked'}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowWords((v) => !v)}
                aria-label={showWords ? 'مخفی کردن' : 'نمایش'}
              >
                {showWords ? '🙈' : '👁'}
              </button>
            </div>
            {submitBlockReason && (
              <p className="hint validation-hint">{submitBlockReason}</p>
            )}
            {needsRepairPreview && repairLoading && !repairAnalysis && (
              <p className="hint repair-loading-hint">در انتظار توقف تایپ — بررسی سبک شروع می‌شود…</p>
            )}
            {repairAnalysis && (
              <MnemonicRepairLog
                analysis={repairAnalysis}
                loading={repairLoading}
                title={
                  checking
                    ? 'در حال بررسی عمیق…'
                    : previewLoading
                      ? 'در حال بررسی…'
                      : 'پیش‌نمایش اصلاح خودکار'
                }
                selectedCandidateId={selectedCandidateId}
                onSelectCandidate={setSelectedCandidateId}
                showWords={showWords}
                onToggleShowWords={() => setShowWords((v) => !v)}
                hasTargetAddress={targetAddress != null}
              />
            )}
            {inputIssue && inputIssue.kind !== 'invalid-checksum' && (
              <p className="hint validation-hint">{formatMnemonicInputIssue(inputIssue)}</p>
            )}
            {hasPassphraseHint && (
              <p className="hint ledger-hint">
                به نظر می‌رسد ۲۵ کلمه وارد کرده‌اید — برای Ledger، ۲۴ کلمه را
                اینجا بگذارید و کلمه ۲۵ (passphrase) را در فیلد پایین.
              </p>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="passphrase">
              Passphrase — کلمه ۲۵ (Ledger)
              <span className="word-badge optional">اختیاری</span>
            </label>
            <div className="textarea-wrap passphrase-wrap">
              <input
                id="passphrase"
                name="pwallet-passphrase"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="passphrase"
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPassphrase((v) => !v)}
                aria-label={showPassphrase ? 'مخفی کردن' : 'نمایش'}
              >
                {showPassphrase ? '🙈' : '👁'}
              </button>
            </div>
            <p className="hint">
              passphrase روی Ledger کیف پول جدا می‌سازد — حروف بزرگ/کوچک مهم است.
            </p>
          </div>

          <div className="input-group">
            <label htmlFor="known-address">
              آدرس شناخته‌شده
              <span className="word-badge optional">اختیاری</span>
            </label>
            <input
              id="known-address"
              name="pwallet-known-address"
              type="text"
              value={knownAddress}
              onChange={(e) => setKnownAddress(e.target.value)}
              placeholder="0x… یا T…"
              dir="ltr"
              spellCheck={false}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
            />
            <p className="hint">
              اگر آدرس کیف پول را می‌دانید، وارد کنید تا بین چینش‌های معتبر، ترتیبی
              انتخاب شود که همان آدرس را بسازد.
            </p>
            {knownAddressIssue && (
              <p className="hint validation-hint">{knownAddressIssue}</p>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={!canSubmit || checking || Boolean(knownAddressIssue)}
          >
            {checking ? 'در حال بررسی…' : 'باز کردن کیف پول'}
          </button>
        </form>

        <div className="security-note">
          <span>🔒</span>
          <div>
            <p>
              عبارت بازیابی و passphrase را با کسی به اشتراک نگذارید. هیچ
              داده‌ای به سرور ارسال نمی‌شود.
            </p>
            <ul className="security-list">
              <li>Ledger: معمولاً ۲۴ کلمه + passphrase اختیاری</li>
              <li>کلید خصوصی فقط در حافظه موقت نگه‌داری می‌شود</li>
              <li>پس از ۱۵ دقیقه بی‌فعالیتی، کیف پول خودکار قفل می‌شود</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
