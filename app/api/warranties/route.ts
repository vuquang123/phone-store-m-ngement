import { NextRequest, NextResponse } from 'next/server'
import { loadWarrantyContracts } from '@/lib/warranty'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId') || undefined
    const imei = searchParams.get('imei') || undefined
    const phone = searchParams.get('phone') || undefined
    const status = searchParams.get('status') || undefined
    const expiringDaysRaw = searchParams.get('expiringDays')
    const expiringDays = expiringDaysRaw ? parseInt(expiringDaysRaw, 10) : undefined
    // Use loader that also computes days left (con_lai)
    const data = await loadWarrantyContracts({ orderId, imei, phone, status, expiringDays })
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[WARRANTIES][GET] error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
