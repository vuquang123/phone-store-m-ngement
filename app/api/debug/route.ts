import { NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

export async function GET() {
  const { header, rows } = await readFromGoogleSheets("Hang_Doi_Tac")
  return NextResponse.json({ header, rowsCount: rows.length, firstRow: rows[0] })
}
