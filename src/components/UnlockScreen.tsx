import { useState } from 'react'
import { assertSecureContext } from '../lib/secureSession'
import { getWordCount, isValidMnemonic } from '../lib/wallet'

interface UnlockScreenProps {
  onUnlock: (mnemonic: string) => void
  secureContextError?: string | null
}

export function UnlockScreen({ onUnlock, secureContextError }: UnlockScreenProps) {
  const [mnemonic, setMnemonic] = useState('')
  const [error, setError] = useState('')
  const [showWords, setShowWords] = useState(false)

  const wordCount = getWordCount(mnemonic)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    try {
      assertSecureContext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'محیط امن نیست')
      return
    }

    if (!isValidMnemonic(mnemonic)) {
      setError('عبارت بازیابی باید ۱۲ یا ۲۴ کلمه معتبر BIP39 باشد')
      return
    }

    const phrase = mnemonic
    setMnemonic('')
    setShowWords(false)
    onUnlock(phrase)
  }

  return (
    <div className="unlock-screen">
      <div className="unlock-card">
        <div className="logo-mark">P</div>
        <h1>باز کردن کیف پول</h1>
        <p className="subtitle">
          عبارت ۲۴ کلمه‌ای (یا ۱۲ کلمه‌ای) خود را وارد کنید. کلیدها فقط در
          مرورگر شما پردازش می‌شوند و ذخیره نمی‌شوند.
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
              <span className={`word-badge ${wordCount === 24 || wordCount === 12 ? 'valid' : ''}`}>
                {wordCount} کلمه
              </span>
            </label>
            <div className="textarea-wrap">
              <textarea
                id="mnemonic"
                name="pwallet-seed-phrase"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="word1 word2 word3 ..."
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
          </div>

          {error && <p className="error">{error}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={wordCount !== 12 && wordCount !== 24}
          >
            باز کردن کیف پول
          </button>
        </form>

        <div className="security-note">
          <span>🔒</span>
          <div>
            <p>
              عبارت بازیابی را با کسی به اشتراک نگذارید. هیچ داده‌ای به سرور
              ارسال نمی‌شود.
            </p>
            <ul className="security-list">
              <li>کلید خصوصی فقط در حافظه موقت نگه‌داری می‌شود</li>
              <li>پس از ۱۵ دقیقه بی‌فعالیتی، کیف پول خودکار قفل می‌شود</li>
              <li>فقط روی HTTPS یا localhost استفاده کنید</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
