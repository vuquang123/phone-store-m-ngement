import { getDefaultGeminiModel, getGeminiClient } from "../../lib/gemini"

const TEST_PROMPT = "Chỉ trả lời chính xác: GEMINI_OK"
const REQUEST_TIMEOUT_MS = 15000

function mapGeminiError(error: unknown) {
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

export async function testGeminiConnection(): Promise<{
  success: boolean
  model: string
  message: string
}> {
  const model = getDefaultGeminiModel()
  const ai = getGeminiClient()

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model,
        contents: TEST_PROMPT,
        config: {
          maxOutputTokens: 8,
          temperature: 0,
          responseMimeType: "text/plain",
        },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Gemini request timeout")), REQUEST_TIMEOUT_MS)
      }),
    ])

    const message = String(response.text || "").trim()
    if (!message) {
      return {
        success: false,
        model,
        message: "Gemini không trả về nội dung.",
      }
    }

    return {
      success: true,
      model,
      message,
    }
  } catch (error) {
    return {
      success: false,
      model,
      message: mapGeminiError(error),
    }
  }
}
