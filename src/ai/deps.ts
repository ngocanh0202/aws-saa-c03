import type { FirebaseApp } from 'firebase/app';
import type { FirebaseConfig, LocalAiConfig } from '../sync/config';
import type { LocalSettingsStore } from './local-settings';
import type { AiClient, ChatHistoryStore } from './types';

/** Model mặc định (Gemini 2.5 ngừng hoạt động từ 10/2026). Đổi bằng VITE_GEMINI_MODEL. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

/**
 * Chỉ tạo `ai` khi có khóa reCAPTCHA: Firebase bắt buộc App Check cho AI Logic (từ 02/11/2026),
 * không có khóa thì gọi Gemini luôn bị từ chối nên ẩn nút. `chats` không phụ thuộc App Check.
 */
export function buildAiDeps(
  config: FirebaseConfig | null,
  clients: { app: FirebaseApp; chats: ChatHistoryStore; localChats?: ChatHistoryStore; localSettings?: LocalSettingsStore } | null,
  createGemini: (app: FirebaseApp, model: string) => AiClient,
  local?: { config: LocalAiConfig | null; create: (url: string, model?: string) => AiClient },
): { ai?: AiClient; chats?: ChatHistoryStore; localAi?: AiClient; localChats?: ChatHistoryStore; localSettings?: LocalSettingsStore } {
  const ai = clients && config?.recaptchaSiteKey ? createGemini(clients.app, config.geminiModel ?? DEFAULT_GEMINI_MODEL) : undefined;
  // AI thử nghiệm không cần App Check, nhưng cần Firebase (đăng nhập + lưu lịch sử ở localChats).
  const localAi = clients?.localChats && local?.config ? local.create(local.config.url, local.config.model) : undefined;
  return {
    ai,
    chats: clients?.chats,
    localAi,
    localChats: localAi ? clients?.localChats : undefined,
    localSettings: localAi ? clients?.localSettings : undefined,
  };
}
