import { useEffect, useMemo, useState } from 'react'
import {
  analyzeMnemonicRepairAsync,
  type MnemonicRepairAnalysis,
  parseRepairTargetAddress,
} from '../lib/wallet'

const REPAIR_DEBOUNCE_MS = 700

export function useDebouncedRepairAnalysis(
  mnemonic: string,
  passphrase: string,
  knownAddress: string,
  enabled: boolean,
) {
  const [analysis, setAnalysis] = useState<MnemonicRepairAnalysis | null>(null)
  const [loading, setLoading] = useState(false)

  const targetAddress = useMemo(
    () => parseRepairTargetAddress(knownAddress),
    [knownAddress],
  )

  useEffect(() => {
    if (!enabled) {
      setAnalysis(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setAnalysis(null)

      analyzeMnemonicRepairAsync(mnemonic, passphrase, {
        allowDoubleSwap: false,
        targetAddress,
        isCancelled: () => cancelled,
        onUpdate: (partial) => {
          if (!cancelled) setAnalysis(partial)
        },
      })
        .then((result) => {
          if (!cancelled) setAnalysis(result)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, REPAIR_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mnemonic, passphrase, knownAddress, targetAddress, enabled])

  return { analysis, loading, targetAddress }
}
