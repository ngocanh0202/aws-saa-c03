import type { ChatMessage } from './types';

/**
 * Đọc lịch sử chat đã lưu (chuỗi JSON). Hỏng hay sai dạng thì rỗng; `suggestions` sai kiểu thì chỉ bỏ
 * trường đó, không bỏ cả cuộc chat.
 */
export function parseChatJson(json: unknown): ChatMessage[] {
  if (typeof json !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    const ok = parsed.every((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string');
    if (!ok) return [];
    return (parsed as ChatMessage[]).map((m) => {
      if (m.suggestions === undefined) return m;
      if (Array.isArray(m.suggestions) && m.suggestions.every((s) => typeof s === 'string')) return m;
      const { suggestions: _drop, ...rest } = m;
      return rest;
    });
  } catch {
    return [];
  }
}
