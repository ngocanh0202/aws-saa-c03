/**
 * Giờ hết "khóa" Gemini sau lỗi 429/503: dùng chung cho mọi khung chat (hết lượt là của cả project,
 * không riêng câu nào), lưu vào localStorage để tải lại trang vẫn còn. Không đồng bộ giữa các máy.
 */
export interface Cooldown {
  /** Giờ (ms) hết khóa; không khóa (hoặc đã hết giờ) thì null. */
  until(): number | null;
  /** Khóa tới giờ này (giữ giờ muộn hơn nếu đang khóa). */
  set(until: number): void;
  subscribe(listener: () => void): () => void;
}

export const COOLDOWN_KEY = 'saa-c03:ai-cooldown:v1';

export function createCooldown(storage: Storage | null, now: () => number = Date.now): Cooldown {
  let value: number | null = null;
  try {
    const saved = Number(storage?.getItem(COOLDOWN_KEY));
    if (Number.isFinite(saved) && saved > 0) value = saved;
  } catch {
    // storage bị chặn: chỉ giữ trong bộ nhớ
  }
  const listeners = new Set<() => void>();
  return {
    until: () => (value !== null && value > now() ? value : null),
    set(until) {
      const current = value !== null && value > now() ? value : 0;
      value = Math.max(current, until);
      try {
        storage?.setItem(COOLDOWN_KEY, String(value));
      } catch {
        // hết dung lượng hay bị chặn: vẫn khóa trong phiên này
      }
      for (const l of [...listeners]) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

const memory = new WeakMap<object, Cooldown>();

/** Bản trong bộ nhớ khi app không truyền cooldown (test); một bản cho mỗi AiClient. */
export function memoryCooldownFor(owner: object): Cooldown {
  let c = memory.get(owner);
  if (!c) memory.set(owner, (c = createCooldown(null)));
  return c;
}
