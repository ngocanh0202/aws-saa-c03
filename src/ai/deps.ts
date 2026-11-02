import type { FirebaseApp } from 'firebase/app';
import type { FirebaseConfig } from '../sync/config';
import type { AiClient, ChatHistoryStore } from './types';

/** Model mặc định (Gemini 2.5 ngừng hoạt động từ 10/2026). Đổi bằng VITE_GEMINI_MODEL. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

/**
 * Chỉ tạo `ai` khi có khóa reCAPTCHA: Firebase bắt buộc App Check cho AI Logic (từ 02/11/2026),
 * không có khóa thì gọi Gemini luôn bị từ chối nên ẩn nút. `chats` không phụ thuộc App Check.
 */
export function buildAiDeps(
  config: FirebaseConfig | null,
  clients: { app: FirebaseApp; chats: ChatHistoryStore } | null,
  createGemini: (app: FirebaseApp, model: string) => AiClient,
): { ai?: AiClient; chats?: ChatHistoryStore } {
  const ai = clients && config?.recaptchaSiteKey ? createGemini(clients.app, config.geminiModel ?? DEFAULT_GEMINI_MODEL) : undefined;
  return { ai, chats: clients?.chats };
}
