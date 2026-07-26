import { config } from "dotenv"
import { GoogleGenAI } from "@google/genai"

config({ path: ".env.local", override: false })
config({ path: ".env", override: false })

const apiKey = String(process.env.GEMINI_API_KEY || "").trim()
const model = String(process.env.GEMINI_MODEL || "gemini-2.0-flash").trim()

if (!apiKey) {
  console.log("Bỏ qua test Gemini vì GEMINI_API_KEY đang trống.")
  process.exit(0)
}

function mapGeminiError(error) {
  const message = error instanceof Error ? error.message : "Không thể kết nối Gemini"
  const lowered = message.toLowerCase()
  if (lowered.includes("no longer available") || (lowered.includes("not_found") && lowered.includes("model"))) {
    return "Model Gemini hiện tại không còn khả dụng. Hãy đổi GEMINI_MODEL sang model còn được hỗ trợ."
  }
  if (lowered.includes("quota") || lowered.includes("429")) {
    return "Gemini đang vượt quota hoặc bị giới hạn tạm thời."
  }
  if (lowered.includes("api key") || lowered.includes("401") || lowered.includes("403") || lowered.includes("unauthorized")) {
    return "Gemini API key không hợp lệ hoặc chưa được cấp quyền."
  }
  if (lowered.includes("fetch failed") || lowered.includes("network") || lowered.includes("timed out") || lowered.includes("timeout")) {
    return "Không thể kết nối Gemini do lỗi mạng hoặc timeout."
  }
  return message
}

try {
  const ai = new GoogleGenAI({ apiKey })
  const response = await Promise.race([
    ai.models.generateContent({
      model,
      contents: "Chỉ trả lời chính xác: GEMINI_OK",
      config: {
        maxOutputTokens: 8,
        temperature: 0,
        responseMimeType: "text/plain",
      },
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Gemini request timeout")), 15000)
    }),
  ])

  const message = String(response.text || "").trim()
  if (!message) {
    console.error("Gemini test failed: Gemini không trả về nội dung.")
    process.exit(1)
  }

  console.log(`Gemini test OK: ${model} -> ${message}`)
  process.exit(0)
} catch (error) {
  console.error(`Gemini test failed: ${mapGeminiError(error)}`)
  process.exit(1)
}
