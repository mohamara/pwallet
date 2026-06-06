const SENSITIVE_PATTERNS = [
  /private\s*key/i,
  /mnemonic/i,
  /seed/i,
  /0x[a-fA-F0-9]{64}/,
  /\b[a-z]+(?:\s+[a-z]+){11,23}\b/i,
]

export function toSafeErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback

  const message = err.message.trim()
  if (!message) return fallback

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) return fallback
  }

  if (message.length > 180) return fallback

  return message
}
