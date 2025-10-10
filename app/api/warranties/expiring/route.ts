import { NextRequest, NextResponse } from 'next/server'
import { loadWarrantyContracts } from '@/lib/warranty'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/warranties/expiring?days=30[&phone=...] => các HĐ còn hạn <= days (mặc định 30)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Number(searchParams.get('days') || searchParams.get('expiringDays') || 30)
    const phone = searchParams.get('phone') || undefined
    const data = await loadWarrantyContracts({ expiringDays: days, phone })
    return NextResponse.json({ data, days })
  } catch (e: any) {
    console.error('[WARRANTIES][EXPIRING] error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
