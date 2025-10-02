import { NextResponse } from "next/server"
import { google } from "googleapis"

export const dynamic = "force-dynamic"

// Utility to mask strings (keep start & end few chars)
function mask(value: string, keep: number = 4) {
  if (!value) return "";
  if (value.length <= keep * 2) return "*".repeat(Math.max(0, value.length - 2))
  return value.slice(0, keep) + "..." + value.slice(-keep)
}

async function getKeyFingerprint(rawKey: string) {
  try {
    if (!rawKey) return null
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex')
    return hash.slice(0, 16) // short fingerprint
  } catch {
    return null
  }
}

export async function GET() {
  const email = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ""
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || ""
  const sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID || ""

  const result: any = {
    emailSet: !!email,
    emailMasked: mask(email),
    keyPresent: !!rawKey,
    keyFingerprint: null as string | null,
    spreadsheetIdSet: !!sheetId,
    spreadsheetIdMasked: mask(sheetId, 3),
    ableToAuthorize: false,
    ableToReadUsersHeader: false,
    failures: [] as string[],
  }

  result.keyFingerprint = await getKeyFingerprint(rawKey)

  if (!email) result.failures.push("Missing service account email env")
  if (!rawKey) result.failures.push("Missing private key env")
  if (!sheetId) result.failures.push("Missing sheet id env")

  if (email && rawKey) {
    try {
      const jwt = new google.auth.JWT({
        email,
        key: rawKey.replace(/\\n/g, '\n'),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      })
      await jwt.authorize()
      result.ableToAuthorize = true
      if (sheetId) {
        try {
          const sheets = google.sheets({ version: "v4", auth: jwt })
            // Just read header of USERS sheet if exists
          await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: "USERS!A1:Z1",
          })
          result.ableToReadUsersHeader = true
        } catch (e: any) {
          result.failures.push("Read USERS header failed: " + (e?.message || e))
        }
      }
    } catch (e: any) {
      result.failures.push("JWT authorize failed: " + (e?.message || e))
    }
  }

  return NextResponse.json(result, { status: result.failures.length ? 500 : 200 })
}
