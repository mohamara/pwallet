import type {
  MnemonicRepairAnalysis,
  RepairCandidateView,
  RepairCheckStatus,
} from '../lib/wallet'
import { formatMnemonicSwapFix } from '../lib/wallet'

interface MnemonicRepairLogProps {
  analysis: MnemonicRepairAnalysis
  activeStepIndex?: number
  title?: string
  loading?: boolean
  selectedCandidateId?: string | null
  onSelectCandidate?: (candidateId: string) => void
  showWords: boolean
  onToggleShowWords: () => void
}

function maskSensitiveText(text: string): string {
  return text.replace(/«[^»]+»/g, '••••••')
}

function detailHasWords(detail: string): boolean {
  return detail.includes('«')
}

function formatCandidateDetail(candidate: RepairCandidateView): string {
  return candidate.swaps.map(formatMnemonicSwapFix).join(' + ')
}

function statusIcon(status: RepairCheckStatus): string {
  switch (status) {
    case 'ok':
      return '✓'
    case 'fail':
      return '✕'
    case 'running':
      return '…'
    case 'skip':
      return '–'
    case 'pending':
      return '○'
  }
}

export function MnemonicRepairLog({
  analysis,
  activeStepIndex,
  title = 'بررسی و اصلاح خودکار',
  loading = false,
  selectedCandidateId,
  onSelectCandidate,
  showWords,
  onToggleShowWords,
}: MnemonicRepairLogProps) {
  const showAll = activeStepIndex === undefined
  const selectable = Boolean(onSelectCandidate) && analysis.candidates.length > 0

  return (
    <div className={`repair-log${loading ? ' is-loading' : ''}`} aria-live="polite">
      <div className="repair-log-header">
        <span className="repair-log-title">{title}</span>
        <div className="repair-log-actions">
          {loading && <span className="repair-log-meta">در حال پردازش…</span>}
          {!loading && analysis.pairChecks > 0 && (
            <span className="repair-log-meta">{analysis.pairChecks} جفت بررسی شد</span>
          )}
          <button
            type="button"
            className="repair-toggle-visibility"
            onClick={onToggleShowWords}
            aria-label={showWords ? 'مخفی کردن کلمات' : 'نمایش کلمات'}
          >
            {showWords ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <ol className="repair-steps">
        {analysis.steps.map((step, index) => {
          const visible = showAll || index <= activeStepIndex
          if (!visible) return null

          const isActive = !showAll && index === activeStepIndex

          return (
            <li
              key={step.id}
              className={`repair-step status-${step.status}${isActive ? ' active' : ''}`}
            >
              <span className="repair-step-icon" aria-hidden>
                {statusIcon(step.status)}
              </span>
              <div className="repair-step-body">
                <span className="repair-step-label">{step.label}</span>
                {step.detail && (
                  <span
                    className={`repair-step-detail${
                      !showWords && detailHasWords(step.detail) ? ' masked' : ''
                    }`}
                  >
                    {showWords ? step.detail : maskSensitiveText(step.detail)}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {(showAll || (activeStepIndex ?? 0) >= analysis.steps.length - 1) &&
        analysis.candidates.length > 0 && (
          <div className="repair-candidates">
            <p className="repair-candidates-title">
              {selectable
                ? 'حالت‌های معتبر — یکی را انتخاب کنید'
                : 'حالت‌های معتبر (برتر)'}
            </p>
            {selectable && analysis.result && analysis.result.alternateCandidates > 1 && (
              <p className="repair-candidates-hint">
                اگر آدرس با Ledger یکی نبود، حالت دیگر را امتحان کنید.
              </p>
            )}
            <ul>
              {analysis.candidates.map((candidate) => {
                const isSelected =
                  selectedCandidateId != null
                    ? candidate.id === selectedCandidateId
                    : candidate.selected
                const detail = formatCandidateDetail(candidate)

                if (selectable) {
                  return (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        className={`repair-candidate-btn${isSelected ? ' selected' : ''}`}
                        onClick={() => onSelectCandidate?.(candidate.id)}
                        aria-pressed={isSelected}
                      >
                        <span className="candidate-rank">
                          {candidate.swaps.length === 1 ? '۱ swap' : '۲ swap'}
                        </span>
                        <span
                          dir="ltr"
                          className={`candidate-detail${showWords ? '' : ' masked'}`}
                        >
                          {showWords ? detail : maskSensitiveText(detail)}
                        </span>
                        <span className="candidate-score">امتیاز {candidate.score}</span>
                        {isSelected && <span className="candidate-badge">انتخاب شد</span>}
                      </button>
                    </li>
                  )
                }

                return (
                  <li
                    key={candidate.id}
                    className={isSelected ? 'selected' : ''}
                  >
                    <span className="candidate-rank">
                      {candidate.swaps.length === 1 ? '۱ swap' : '۲ swap'}
                    </span>
                    <span
                      dir="ltr"
                      className={`candidate-detail${showWords ? '' : ' masked'}`}
                    >
                      {showWords ? detail : maskSensitiveText(detail)}
                    </span>
                    <span className="candidate-score">امتیاز {candidate.score}</span>
                    {isSelected && <span className="candidate-badge">انتخاب شد</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
    </div>
  )
}
