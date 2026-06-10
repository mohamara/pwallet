export type DerivationStandard = 'bip32' | 'bip44' | 'bip49' | 'bip84' | 'bip141' | 'custom'

/** standard = BIP44-style account/change/address — ledger = Ledger Live account layout */
export type DerivationLayout = 'standard' | 'ledger'

export interface DerivationConfig {
  standard: DerivationStandard
  layout: DerivationLayout
  accountIndex: number
  changeIndex: number
  addressIndex: number
  customEvmPath?: string
  customTronPath?: string
  coinTypeEvm?: number
  coinTypeTron?: number
}

export const DERIVATION_STANDARDS: DerivationStandard[] = [
  'bip32',
  'bip44',
  'bip49',
  'bip84',
  'bip141',
  'custom',
]

export const STANDARD_META: Record<
  Exclude<DerivationStandard, 'custom'>,
  { label: string; purpose: number; description: string }
> = {
  bip32: {
    label: 'BIP32',
    purpose: 32,
    description: 'HD wallet پایه — purpose=32',
  },
  bip44: {
    label: 'BIP44',
    purpose: 44,
    description: 'مسیر چندارزی استاندارد — purpose=44',
  },
  bip49: {
    label: 'BIP49',
    purpose: 49,
    description: 'SegWit تو در تو (P2SH-P2WPKH) — purpose=49',
  },
  bip84: {
    label: 'BIP84',
    purpose: 84,
    description: 'SegWit بومی — purpose=84',
  },
  bip141: {
    label: 'BIP141',
    purpose: 141,
    description: 'SegWit (BIP141) — purpose=141',
  },
}

const PATH_SEGMENT_RE = /^(\d+'?)$/

export function isValidDerivationPath(path: string): boolean {
  const trimmed = path.trim()
  if (!trimmed.startsWith('m/')) return false
  const segments = trimmed.slice(2).split('/').filter(Boolean)
  if (segments.length === 0) return false
  return segments.every((segment) => PATH_SEGMENT_RE.test(segment))
}

function purposeForStandard(standard: Exclude<DerivationStandard, 'custom'>): number {
  return STANDARD_META[standard].purpose
}

function coinType(chain: 'evm' | 'tron', config: DerivationConfig): number {
  if (chain === 'evm') return config.coinTypeEvm ?? 60
  return config.coinTypeTron ?? 195
}

function clampIndex(value: number, max = 2_147_483_647): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(Math.floor(value), max)
}

export function normalizeDerivationConfig(config: DerivationConfig): DerivationConfig {
  return {
    ...config,
    accountIndex: clampIndex(config.accountIndex),
    changeIndex: clampIndex(config.changeIndex, 1),
    addressIndex: clampIndex(config.addressIndex),
    customEvmPath: config.customEvmPath?.trim() || undefined,
    customTronPath: config.customTronPath?.trim() || undefined,
    coinTypeEvm:
      config.coinTypeEvm != null && Number.isFinite(config.coinTypeEvm)
        ? clampIndex(config.coinTypeEvm)
        : undefined,
    coinTypeTron:
      config.coinTypeTron != null && Number.isFinite(config.coinTypeTron)
        ? clampIndex(config.coinTypeTron)
        : undefined,
  }
}

export function resolveDefaultDerivationConfig(
  mnemonicWordCount: number,
  hasPassphrase: boolean,
): DerivationConfig {
  return normalizeDerivationConfig({
    standard: 'bip44',
    layout: hasPassphrase || mnemonicWordCount === 24 ? 'ledger' : 'standard',
    accountIndex: 0,
    changeIndex: 0,
    addressIndex: 0,
  })
}

export function buildDerivationPathFromConfig(
  config: DerivationConfig,
  chain: 'evm' | 'tron',
): string {
  const normalized = normalizeDerivationConfig(config)

  if (normalized.standard === 'custom') {
    const path = chain === 'evm' ? normalized.customEvmPath : normalized.customTronPath
    if (!path || !isValidDerivationPath(path)) {
      throw new Error('مسیر derivation سفارشی نامعتبر است')
    }
    return path
  }

  const purpose = purposeForStandard(normalized.standard)
  const coin = coinType(chain, normalized)

  if (normalized.layout === 'ledger') {
    return `m/${purpose}'/${coin}'/${normalized.accountIndex}'/0/0`
  }

  return `m/${purpose}'/${coin}'/${normalized.accountIndex}'/${normalized.changeIndex}/${normalized.addressIndex}`
}

export function formatDerivationStandard(config: DerivationConfig): string {
  if (config.standard === 'custom') return 'Custom'
  return STANDARD_META[config.standard].label
}

export function formatDerivationLayout(config: DerivationConfig): string {
  return config.layout === 'ledger' ? 'Ledger Live' : 'Standard'
}

export function validateDerivationConfig(config: DerivationConfig): string | null {
  const normalized = normalizeDerivationConfig(config)

  if (normalized.standard === 'custom') {
    if (!normalized.customEvmPath && !normalized.customTronPath) {
      return 'حداقل یک مسیر سفارشی (EVM یا TRON) را وارد کنید.'
    }
    if (normalized.customEvmPath && !isValidDerivationPath(normalized.customEvmPath)) {
      return 'مسیر EVM نامعتبر است — باید با m/ شروع شود (مثلاً m/44\'/60\'/0\'/0/0).'
    }
    if (normalized.customTronPath && !isValidDerivationPath(normalized.customTronPath)) {
      return 'مسیر TRON نامعتبر است — باید با m/ شروع شود (مثلاً m/44\'/195\'/0\'/0/0).'
    }
    return null
  }

  if (normalized.layout === 'standard' && normalized.changeIndex > 1) {
    return 'شاخه change فقط ۰ (دریافت) یا ۱ (باقیمانده) می‌تواند باشد.'
  }

  return null
}

/** پروفایل‌های رایج برای تطبیق آدرس در repair */
export function commonRepairDerivationConfigs(): DerivationConfig[] {
  const bases: Array<Pick<DerivationConfig, 'standard' | 'layout'>> = [
    { standard: 'bip44', layout: 'standard' },
    { standard: 'bip44', layout: 'ledger' },
    { standard: 'bip49', layout: 'standard' },
    { standard: 'bip49', layout: 'ledger' },
    { standard: 'bip84', layout: 'standard' },
    { standard: 'bip84', layout: 'ledger' },
    { standard: 'bip141', layout: 'standard' },
    { standard: 'bip141', layout: 'ledger' },
    { standard: 'bip32', layout: 'standard' },
    { standard: 'bip32', layout: 'ledger' },
  ]

  return bases.map((base) =>
    normalizeDerivationConfig({
      ...base,
      accountIndex: 0,
      changeIndex: 0,
      addressIndex: 0,
    }),
  )
}

export function repairDerivationCandidates(
  preferred: DerivationConfig,
): DerivationConfig[] {
  const seen = new Set<string>()
  const list: DerivationConfig[] = []

  const push = (config: DerivationConfig) => {
    const key = JSON.stringify(normalizeDerivationConfig(config))
    if (seen.has(key)) return
    seen.add(key)
    list.push(normalizeDerivationConfig(config))
  }

  push(preferred)
  for (const config of commonRepairDerivationConfigs()) {
    push(config)
  }

  return list
}
