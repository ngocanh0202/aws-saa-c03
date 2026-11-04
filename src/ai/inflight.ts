import type { ChatMessage } from './types';

/**
 * Câu trả lời Gemini đang chạy, theo `${uid}/${attemptId}/${qid}`. Câu trả lời không gắn với khung
 * chat: người học sang câu khác hay đóng khung thì nó vẫn chạy ở nền và được lưu; mở lại khung thì
 * theo dõi tiếp từ đây.
 */
export type InflightEvent =
  /** Đang trả lời: tin nhắn hiện có (gồm câu hỏi và phần trả lời đã nhận). */
  | { kind: 'progress'; messages: ChatMessage[]; searching: boolean; retry?: { attempt: number; max: number } }
  /** Xong; failed = không có câu trả lời (lỗi mạng, hết quota…); busy = lỗi vì Gemini hết lượt/quá tải. */
  | { kind: 'done'; messages: ChatMessage[]; failed: boolean; busy?: boolean }
  | { kind: 'save-failed' };

export interface InflightRegistry {
  /** Trạng thái đang chạy; không có thì undefined. */
  get(key: string): Extract<InflightEvent, { kind: 'progress' }> | undefined;
  emit(key: string, event: InflightEvent): void;
  subscribe(key: string, listener: (event: InflightEvent) => void): () => void;
}

export function createInflight(): InflightRegistry {
  const running = new Map<string, Extract<InflightEvent, { kind: 'progress' }>>();
  const listeners = new Map<string, Set<(event: InflightEvent) => void>>();
  return {
    get: (key) => running.get(key),
    emit(key, event) {
      if (event.kind === 'progress') running.set(key, event);
      else running.delete(key);
      for (const l of [...(listeners.get(key) ?? [])]) l(event);
    },
    subscribe(key, listener) {
      const set = listeners.get(key) ?? new Set();
      set.add(listener);
      listeners.set(key, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(key);
      };
    },
  };
}

const registries = new WeakMap<object, InflightRegistry>();

/** Một sổ cho mỗi nơi lưu lịch sử chat (app thật chỉ có một; mỗi test có sổ riêng). */
export function inflightFor(owner: object): InflightRegistry {
  let r = registries.get(owner);
  if (!r) registries.set(owner, (r = createInflight()));
  return r;
}

export const inflightKey = (uid: string, attemptId: string, qid: number) => `${uid}/${attemptId}/${qid}`;
