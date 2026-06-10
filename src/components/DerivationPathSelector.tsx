import { useMemo } from 'react'
import {
  DERIVATION_STANDARDS,
  STANDARD_META,
  buildDerivationPathFromConfig,
  formatDerivationLayout,
  formatDerivationStandard,
  normalizeDerivationConfig,
  validateDerivationConfig,
  type DerivationConfig,
  type DerivationLayout,
} from '../lib/derivation'

interface DerivationPathSelectorProps {
  config: DerivationConfig
  onChange: (config: DerivationConfig) => void
  disabled?: boolean
}

function updateConfig(
  current: DerivationConfig,
  patch: Partial<DerivationConfig>,
): DerivationConfig {
  return normalizeDerivationConfig({ ...current, ...patch })
}

export function DerivationPathSelector({
  config,
  onChange,
  disabled = false,
}: DerivationPathSelectorProps) {
  const normalized = useMemo(() => normalizeDerivationConfig(config), [config])
  const validationError = useMemo(() => validateDerivationConfig(normalized), [normalized])

  const evmPreview = useMemo(() => {
    try {
      return buildDerivationPathFromConfig(normalized, 'evm')
    } catch {
      return '—'
    }
  }, [normalized])

  const tronPreview = useMemo(() => {
    try {
      return buildDerivationPathFromConfig(normalized, 'tron')
    } catch {
      return '—'
    }
  }, [normalized])

  const isCustom = normalized.standard === 'custom'

  return (
    <div className="derivation-panel">
      <div className="derivation-panel-header">
        <h3>Derivation Path</h3>
        <span className="word-badge optional">پیشرفته</span>
      </div>

      <div className="derivation-standards">
        {DERIVATION_STANDARDS.map((standard) => {
          const meta =
            standard === 'custom'
              ? { label: 'Custom', description: 'مسیر کامل دستی m/…' }
              : STANDARD_META[standard]
          const active = normalized.standard === standard

          return (
            <button
              key={standard}
              type="button"
              className={`derivation-standard-chip ${active ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => onChange(updateConfig(normalized, { standard }))}
            >
              <span className="derivation-standard-label">{meta.label}</span>
              <span className="derivation-standard-desc">{meta.description}</span>
            </button>
          )
        })}
      </div>

      {!isCustom && (
        <>
          <div className="derivation-row">
            <label htmlFor="derivation-layout">Layout</label>
            <select
              id="derivation-layout"
              value={normalized.layout}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  updateConfig(normalized, { layout: e.target.value as DerivationLayout }),
                )
              }
            >
              <option value="standard">Standard — m/purpose&apos;/coin&apos;/account&apos;/change/address</option>
              <option value="ledger">Ledger Live — m/purpose&apos;/coin&apos;/account&apos;/0/0</option>
            </select>
          </div>

          <div className="derivation-index-grid">
            <div className="derivation-row">
              <label htmlFor="derivation-account">Account</label>
              <input
                id="derivation-account"
                type="number"
                min={0}
                inputMode="numeric"
                dir="ltr"
                disabled={disabled}
                value={normalized.accountIndex}
                onChange={(e) =>
                  onChange(
                    updateConfig(normalized, {
                      accountIndex: Number.parseInt(e.target.value, 10) || 0,
                    }),
                  )
                }
              />
            </div>

            {normalized.layout === 'standard' && (
              <>
                <div className="derivation-row">
                  <label htmlFor="derivation-change">Change</label>
                  <select
                    id="derivation-change"
                    value={normalized.changeIndex}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        updateConfig(normalized, {
                          changeIndex: Number.parseInt(e.target.value, 10) || 0,
                        }),
                      )
                    }
                  >
                    <option value={0}>0 — External</option>
                    <option value={1}>1 — Internal</option>
                  </select>
                </div>

                <div className="derivation-row">
                  <label htmlFor="derivation-address">Address</label>
                  <input
                    id="derivation-address"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    dir="ltr"
                    disabled={disabled}
                    value={normalized.addressIndex}
                    onChange={(e) =>
                      onChange(
                        updateConfig(normalized, {
                          addressIndex: Number.parseInt(e.target.value, 10) || 0,
                        }),
                      )
                    }
                  />
                </div>
              </>
            )}
          </div>

          <details className="derivation-advanced">
            <summary>Coin type (پیشرفته)</summary>
            <div className="derivation-index-grid">
              <div className="derivation-row">
                <label htmlFor="coin-type-evm">EVM coin type</label>
                <input
                  id="coin-type-evm"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="60"
                  disabled={disabled}
                  value={normalized.coinTypeEvm ?? ''}
                  onChange={(e) =>
                    onChange(
                      updateConfig(normalized, {
                        coinTypeEvm:
                          e.target.value === ''
                            ? undefined
                            : Number.parseInt(e.target.value, 10) || 0,
                      }),
                    )
                  }
                />
              </div>
              <div className="derivation-row">
                <label htmlFor="coin-type-tron">TRON coin type</label>
                <input
                  id="coin-type-tron"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="195"
                  disabled={disabled}
                  value={normalized.coinTypeTron ?? ''}
                  onChange={(e) =>
                    onChange(
                      updateConfig(normalized, {
                        coinTypeTron:
                          e.target.value === ''
                            ? undefined
                            : Number.parseInt(e.target.value, 10) || 0,
                      }),
                    )
                  }
                />
              </div>
            </div>
          </details>
        </>
      )}

      {isCustom && (
        <div className="derivation-custom-paths">
          <div className="derivation-row">
            <label htmlFor="custom-evm-path">مسیر EVM</label>
            <input
              id="custom-evm-path"
              type="text"
              dir="ltr"
              spellCheck={false}
              autoComplete="off"
              placeholder="m/44'/60'/0'/0/0"
              disabled={disabled}
              value={normalized.customEvmPath ?? ''}
              onChange={(e) =>
                onChange(updateConfig(normalized, { customEvmPath: e.target.value }))
              }
            />
          </div>
          <div className="derivation-row">
            <label htmlFor="custom-tron-path">مسیر TRON</label>
            <input
              id="custom-tron-path"
              type="text"
              dir="ltr"
              spellCheck={false}
              autoComplete="off"
              placeholder="m/44'/195'/0'/0/0"
              disabled={disabled}
              value={normalized.customTronPath ?? ''}
              onChange={(e) =>
                onChange(updateConfig(normalized, { customTronPath: e.target.value }))
              }
            />
          </div>
        </div>
      )}

      <div className="derivation-preview">
        <p className="derivation-preview-title">
          {formatDerivationStandard(normalized)} · {formatDerivationLayout(normalized)}
        </p>
        <p className="mono" dir="ltr">
          EVM: {evmPreview}
        </p>
        <p className="mono" dir="ltr">
          TRON: {tronPreview}
        </p>
      </div>

      {validationError && (
        <p className="hint validation-hint">{validationError}</p>
      )}
    </div>
  )
}

export function isDerivationConfigValid(config: DerivationConfig): boolean {
  return validateDerivationConfig(normalizeDerivationConfig(config)) === null
}
