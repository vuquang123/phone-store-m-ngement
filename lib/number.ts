export function parseVietnameseNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  const raw = String(value ?? "").trim()
  if (!raw) return 0

  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return 0

  const looksLikeGroupedThousands = (input: string, separator: "." | ",") => {
    if (!input.includes(separator)) return false
    const normalizedInput = input.replace(/^-/, "")
    const parts = normalizedInput.split(separator)
    if (parts.length < 2) return false
    if (!parts[0] || parts[0].length > 3) return false
    return parts.slice(1).every((part) => /^\d{3}$/.test(part))
  }

  const normalized = (() => {
    if (cleaned.includes(",") && cleaned.includes(".")) {
      return cleaned.replace(/\./g, "").replace(",", ".")
    }
    if (looksLikeGroupedThousands(cleaned, ".")) {
      return cleaned.replace(/\./g, "")
    }
    if (looksLikeGroupedThousands(cleaned, ",")) {
      return cleaned.replace(/,/g, "")
    }
    if (cleaned.includes(",")) {
      return cleaned.replace(",", ".")
    }
    return cleaned
  })()

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseVietnameseInteger(value: unknown): number {
  return Math.round(parseVietnameseNumber(value))
}
