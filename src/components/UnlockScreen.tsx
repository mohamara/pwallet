import { useMemo, useState } from 'react'
import { assertSecureContext } from '../lib/secureSession'
import {
  canSubmitMnemonicInput,
  formatMnemonicInputIssue,
  getMnemonicInputIssue,
  getSubmitBlockReason,
  getWordCount,
  parseMnemonicInput,
} from '../lib/wallet'

interface UnlockScreenProps {
  onUnlock: (mnemonic: string, passphrase?: string) => void
  secureContextError?: string | null
}

const PASSPHRASE_HINT_COUNTS = [13, 16, 19, 22, 25]

export function UnlockScreen({ onUnlock, secureContextError }: UnlockScreenProps) {
  const [mnemonic, setMnemonic] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [showWords, setShowWords] = useState(false)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [error, setError] = useState('')

  const wordCount = getWordCount(mnemonic)

  const parsed = useMemo(
    () => parseMnemonicInput(mnemonic, passphrase),
    [mnemonic, passphrase],
  )

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

  const hasPassphraseHint =
    !passphrase.trim() && PASSPHRASE_HINT_COUNTS.includes(wordCount)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    try {
      assertSecureContext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'محیط امن نیست')
      return
    }

    const result = parseMnemonicInput(mnemonic, passphrase)
    if (!result) {
      const issue = getMnemonicInputIssue(mnemonic, passphrase)
      setError(
        issue
          ? formatMnemonicInputIssue(issue)
          : 'عبارت بازیابی نامعتبر است. برای Ledger: ۲۴ کلمه + passphrase (کلمه ۲۵) در فیلد جدا.',
      )
      return
    }

    onUnlock(result.mnemonic, result.passphrase)
    setMnemonic('')
    setPassphrase('')
    setShowWords(false)
    setShowPassphrase(false)
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
            {inputIssue && (
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

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            باز کردن کیف پول
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
