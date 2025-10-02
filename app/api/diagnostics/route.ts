import { NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

export async function GET() {
  const envPresence = {
    GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
    GOOGLE_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    GOOGLE_SHEETS_SPREADSHEET_ID: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SHEETS_ID: !!process.env.GOOGLE_SHEETS_ID,
  }

  let sheetOk = false
  let sheetError: string | null = null
  try {
    if (envPresence.GOOGLE_SERVICE_ACCOUNT_EMAIL || envPresence.GOOGLE_CLIENT_EMAIL) {
      await readFromGoogleSheets("USERS", "A1:C1")
      sheetOk = true
    }
  } catch (e: any) {
    sheetError = e?.message || String(e)
  }

  return NextResponse.json({ envPresence, sheetOk, sheetError })
}