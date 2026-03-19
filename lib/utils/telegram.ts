export async function uploadTelegramProof(files: File[], caption?: string) {
  if (!files || files.length === 0) return
  const form = new FormData()
  files.forEach((file, idx) => form.append("photo", file, file.name || `proof_${idx + 1}.jpg`))
  form.append("message_thread_id", "22")
  if (caption) form.append("caption", caption)
  try {
    const res = await fetch("/api/telegram/send-photo", { method: "POST", body: form })
    return res.json()
  } catch (e) {
    console.warn("[TG] upload proof fail:", e)
    return { success: false, error: e }
  }
}
