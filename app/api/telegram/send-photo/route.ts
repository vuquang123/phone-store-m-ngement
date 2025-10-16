import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramPhotoBase64, sendTelegramPhotoBuffer } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const ctype = request.headers.get('content-type') || ''
    // If multipart/form-data, use request.formData() to extract files
    if (ctype.includes('multipart/form-data')) {
      const form = await request.formData()
      const entries: any[] = []
      // optional params
      const orderType = form.get('orderType') as string | null
      const messageThreadRaw = form.get('message_thread_id') as string | File | null
      const message_thread_id = messageThreadRaw && typeof messageThreadRaw === 'string' ? Number(messageThreadRaw) : undefined
      for (const [key, value] of form.entries()) {
        if (value instanceof File) {
          entries.push({ key, file: value })
        }
      }
      if (entries.length === 0) return NextResponse.json({ error: 'No files' }, { status: 400 })
      const results: any[] = []
      for (const e of entries) {
        const file = e.file as File
        // Limit size: 6MB per file
        const maxBytes = 6 * 1024 * 1024
        if ((file.size || 0) > maxBytes) {
          results.push({ success: false, error: 'File too large', filename: file.name })
          continue
        }
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
  const res = await sendTelegramPhotoBuffer(buffer, file.name || 'image.jpg', '', (orderType as any) || undefined, message_thread_id ? { message_thread_id } : undefined)
        results.push(res)
      }
      return NextResponse.json({ ok: true, results }, { status: 200 })
    }

    // Fallback to JSON body base64 handling
    const body = await request.json()
  const { image, filename, caption, orderType, message_thread_id } = body
    if (!image) return NextResponse.json({ error: 'No image' }, { status: 400 })
  const res = await sendTelegramPhotoBase64(image, filename || 'image.jpg', caption || '', orderType, { message_thread_id })
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed', result: res.result || null }, { status: 500 })
    return NextResponse.json({ ok: true, result: res.result }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error', detail: String(e) }, { status: 500 })
  }
}
