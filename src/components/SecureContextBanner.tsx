export function SecureContextBanner() {
  if (typeof window === 'undefined' || window.isSecureContext) return null

  return (
    <div className="security-banner danger" role="alert">
      اتصال امن (HTTPS) برقرار نیست. استفاده از کیف پول در این حالت توصیه
      نمی‌شود.
    </div>
  )
}
