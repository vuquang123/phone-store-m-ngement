import { GoogleGenAI } from "@google/genai"
import { assertGeminiEnvConfigured, serverEnv } from "./env"

let geminiClient: GoogleGenAI | null = null

// Server-only Gemini client. Tuyệt đối không import file này vào Client Component.
export function getGeminiClient() {
  if (geminiClient) {
    return geminiClient
  }

  const { apiKey } = assertGeminiEnvConfigured()
  geminiClient = new GoogleGenAI({ apiKey })
  return geminiClient
}

export function getDefaultGeminiModel() {
  return serverEnv.geminiModel
}
