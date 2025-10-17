import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage, formatOrderMessage } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
  const { orderInfo, orderType, options } = body
    if (!orderInfo) return NextResponse.json({ error: 'No orderInfo' }, { status: 400 })
    const msg = formatOrderMessage(orderInfo, 'new')
  // forward orderType so helper can choose the correct group/thread
  const res = await sendTelegramMessage(msg, orderType, options)
    if (!res.success) return NextResponse.json({ ok: false, error: res.error }, { status: 500 })
    return NextResponse.json({ ok: true, result: res }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error', detail: String(e) }, { status: 500 })
  }
}
