import { NextResponse } from 'next/server'
import { loadWarrantyPackages } from '@/lib/warranty'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const map = await loadWarrantyPackages()
    const data = Object.values(map).filter(p => p.active)
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Không tải được gói bảo hành' }, { status: 500 })
  }
}
