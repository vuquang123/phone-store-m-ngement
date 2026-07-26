const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
const DEFAULT_REPORT_TIMEZONE = "Asia/Ho_Chi_Minh"

function readOptionalEnv(name: string) {
  const value = process.env[name]
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed || undefined
}

function normalizeGooglePrivateKey(raw?: string) {
  if (!raw) return undefined
  return raw.replace(/\\n/g, "\n")
}

export function getRequiredServerEnv(name: string) {
  const value = readOptionalEnv(name)
  if (!value) {
    throw new Error(`Thiếu cấu hình ${name}`)
  }
  return value
}

export function getGeminiModel() {
  return readOptionalEnv("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL
}

export const serverEnv = {
  get geminiApiKey() {
    return getRequiredServerEnv("GEMINI_API_KEY")
  },
  get geminiModel() {
    return getGeminiModel()
  },
  get spreadsheetId() {
    return readOptionalEnv("GOOGLE_SHEETS_SPREADSHEET_ID")
  },
  get serviceAccountEmail() {
    return readOptionalEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL") || readOptionalEnv("GOOGLE_CLIENT_EMAIL")
  },
  get googlePrivateKey() {
    return normalizeGooglePrivateKey(readOptionalEnv("GOOGLE_PRIVATE_KEY"))
  },
  get cronSecret() {
    return readOptionalEnv("CRON_SECRET")
  },
  get reportTimezone() {
    return readOptionalEnv("REPORT_TIMEZONE") || DEFAULT_REPORT_TIMEZONE
  },
}

export function assertGeminiEnvConfigured() {
  return {
    apiKey: serverEnv.geminiApiKey,
    model: serverEnv.geminiModel,
  }
}

export function assertGoogleSheetsEnvConfigured() {
  if (!serverEnv.spreadsheetId) {
    throw new Error("Thiếu cấu hình GOOGLE_SHEETS_SPREADSHEET_ID")
  }
  if (!serverEnv.serviceAccountEmail) {
    throw new Error("Thiếu cấu hình GOOGLE_SERVICE_ACCOUNT_EMAIL")
  }
  if (!serverEnv.googlePrivateKey) {
    throw new Error("Thiếu cấu hình GOOGLE_PRIVATE_KEY")
  }

  return {
    spreadsheetId: serverEnv.spreadsheetId,
    serviceAccountEmail: serverEnv.serviceAccountEmail,
    googlePrivateKey: serverEnv.googlePrivateKey,
  }
}
