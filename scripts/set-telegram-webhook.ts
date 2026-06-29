// scripts/set-telegram-webhook.ts
// Đăng ký (hoặc kiểm tra / xoá) webhook Telegram — chạy 1 lần sau khi deploy production HTTPS.
//
//   pnpm tsx scripts/set-telegram-webhook.ts            # set webhook
//   pnpm tsx scripts/set-telegram-webhook.ts info       # xem trạng thái
//   pnpm tsx scripts/set-telegram-webhook.ts delete     # xoá webhook (để dùng lại getUpdates)
//
// ENV cần (đặt trong .env.local):
//   TELEGRAM_BOT_TOKEN      — token bot
//   TELEGRAM_WEBHOOK_SECRET — chuỗi bí mật, Telegram gắn vào header mỗi request
//   NEXT_PUBLIC_SITE_URL hoặc PUBLIC_URL — domain thật (https://...), KHÔNG phải localhost
import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim()
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "")

async function api(method: string, body?: any) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function main() {
  if (!TOKEN) { console.error("❌ Thiếu TELEGRAM_BOT_TOKEN"); process.exit(1) }
  const cmd = process.argv[2] || "set"

  if (cmd === "info") {
    console.log(JSON.stringify(await api("getWebhookInfo"), null, 2))
    return
  }
  if (cmd === "delete") {
    console.log(await api("deleteWebhook", { drop_pending_updates: false }))
    console.log("✅ Đã xoá webhook. getUpdates dùng lại được (vd để dò thread id).")
    return
  }

  // set
  if (!SECRET) { console.error("❌ Thiếu TELEGRAM_WEBHOOK_SECRET"); process.exit(1) }
  if (!PUBLIC_URL || !/^https:\/\//i.test(PUBLIC_URL)) {
    console.error("❌ Cần PUBLIC_URL/NEXT_PUBLIC_SITE_URL là domain HTTPS thật (không phải localhost).")
    console.error("   Muốn test local: dùng ngrok/cloudflared rồi đặt PUBLIC_URL = url https đó.")
    process.exit(1)
  }
  const url = `${PUBLIC_URL}/api/public/telegram/webhook`
  const result = await api("setWebhook", {
    url,
    secret_token: SECRET,
    allowed_updates: ["callback_query", "message"],
  })
  console.log("setWebhook ->", JSON.stringify(result))
  if (result?.ok) {
    console.log(`✅ Webhook đã trỏ về: ${url}`)
    console.log("   Kiểm tra: pnpm tsx scripts/set-telegram-webhook.ts info")
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
