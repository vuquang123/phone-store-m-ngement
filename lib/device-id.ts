// Utilities to handle device identifiers: IMEI or Serial
// Normalization is conservative: trim and uppercase for Serial; IMEI stays digits-only when needed by validators,
// but here we treat identifier generically without stripping characters unless explicitly asked.

export type DeviceLike = {
  IMEI?: string
  imei?: string
  Serial?: string
  serial?: string
}

// Return the first available identifier (IMEI preferred if present and non-empty)
export function getDeviceId(obj: DeviceLike | Record<string, any>): string {
  const imei = String((obj as any).IMEI ?? (obj as any).imei ?? '').trim()
  if (imei) return imei
  const serial = String((obj as any).Serial ?? (obj as any).serial ?? '').trim()
  return serial
}

// Returns true if at least one identifier is present
export function hasDeviceId(obj: DeviceLike | Record<string, any>): boolean {
  return !!getDeviceId(obj)
}

// Normalize for comparisons: uppercase and trim. Do not strip digits to preserve Serial characters.
export function normalizeIdentifier(id: string): string {
  return String(id || '').trim().toUpperCase()
}

// Take last 5 characters from identifier (IMEI or Serial). If shorter, return as-is.
export function last5FromDeviceId(id: string): string {
  const s = String(id || '')
  return s.length <= 5 ? s : s.slice(-5)
}

// Type guard: simple IMEI check (15 digits)
export function isImeiLike(id: string): boolean {
  return /^\d{15}$/.test(String(id || ''))
}

// Validate Serial: alphanumeric (and hyphen) 6..30 chars
export function isSerialLike(id: string): boolean {
  return /^[A-Za-z0-9-]{6,30}$/.test(String(id || ''))
}
