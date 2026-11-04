/** Nguồn AI của khung chat: Gemini (mặc định) hoặc AI thử nghiệm chạy trên LM Studio. */
export type AiMode = 'gemini' | 'local';

export interface AiModeStore {
  get(): AiMode;
  set(mode: AiMode): void;
  subscribe(listener: () => void): () => void;
}

export const AI_MODE_KEY = 'saa-c03:ai-mode:v1';

/** Lưu lựa chọn theo máy (localStorage), không đồng bộ giữa các máy. */
export function createAiMode(storage: Storage | null): AiModeStore {
  let mode: AiMode = 'gemini';
  try {
    if (storage?.getItem(AI_MODE_KEY) === 'local') mode = 'local';
  } catch {
    // storage bị chặn: dùng mặc định
  }
  const listeners = new Set<() => void>();
  return {
    get: () => mode,
    set(next) {
      if (next === mode) return;
      mode = next;
      try {
        storage?.setItem(AI_MODE_KEY, next);
      } catch {
        // không lưu được: vẫn đổi trong phiên này
      }
      for (const l of [...listeners]) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
