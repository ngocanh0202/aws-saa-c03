/** Tỉ lệ cột ghi chú khi phóng to (phần chiều rộng màn hình), nhớ trong localStorage. */
export const SPLIT_KEY = 'saa-c03:note-split:v1';
export const DEFAULT_SPLIT = 0.3;
export const MIN_SPLIT = 0.2;
export const MAX_SPLIT = 0.6;
/** Bước phím mũi tên trên thanh kéo. */
export const SPLIT_STEP = 0.02;

/** Kẹp trong [MIN_SPLIT, MAX_SPLIT], làm tròn tới 1%. */
export function clampSplit(r: number): number {
  if (!Number.isFinite(r)) return DEFAULT_SPLIT;
  return Math.round(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, r)) * 100) / 100;
}

export function loadSplit(storage: Storage | null): number {
  try {
    const raw = storage?.getItem(SPLIT_KEY);
    return raw == null ? DEFAULT_SPLIT : clampSplit(Number(raw));
  } catch {
    // storage bị chặn: dùng mặc định
    return DEFAULT_SPLIT;
  }
}

export function saveSplit(storage: Storage | null, r: number): void {
  try {
    storage?.setItem(SPLIT_KEY, String(clampSplit(r)));
  } catch {
    // không lưu được: chỉ đổi trong phiên này
  }
}
