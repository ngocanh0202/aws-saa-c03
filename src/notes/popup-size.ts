/** Cỡ ô ghi chú (popup tô chữ) lần trước, lưu theo loại máy trong localStorage. */
export const POPUP_SIZE_KEY = 'saa-c03:note-popup-size:v1';

export interface PopupSize {
  desktop?: { w: number; h: number };
  mobile?: { h: number };
}

/** Cách mép màn hình (máy tính). */
export const EDGE = 8;
/** Bước phím mũi tên ở góc kéo (máy tính). */
export const KEY_STEP_PX = 16;
/** Bước phím mũi tên ở thanh kéo (điện thoại), tính theo phần cao màn hình. */
export const KEY_STEP_VH = 0.1;
/** Sheet cao tối đa, tính theo phần cao màn hình. */
export const SHEET_MAX_VH = 0.9;
/** Kéo xuống quá cỡ nhỏ nhất bấy nhiêu px thì đóng. */
export const DISMISS_PX = 80;

/** Giữ trong [min, max]; khi max < min (màn hình quá nhỏ) thì lấy min. */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max));
}

const isLen = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Đọc giá trị đã lưu; phần nào hỏng thì bỏ phần đó. */
export function parsePopupSize(raw: string | null): PopupSize {
  let v: unknown;
  try {
    v = JSON.parse(raw ?? 'null');
  } catch {
    return {};
  }
  if (!isObj(v)) return {};
  const out: PopupSize = {};
  const d = v.desktop;
  if (isObj(d) && isLen(d.w) && isLen(d.h)) out.desktop = { w: d.w, h: d.h };
  const m = v.mobile;
  if (isObj(m) && isLen(m.h)) out.mobile = { h: m.h };
  return out;
}

export function loadPopupSize(storage: Storage | null): PopupSize {
  try {
    return parsePopupSize(storage?.getItem(POPUP_SIZE_KEY) ?? null);
  } catch {
    // storage bị chặn: dùng cỡ mặc định
    return {};
  }
}

/** Gộp vào giá trị đã lưu (máy tính và điện thoại lưu riêng). */
export function savePopupSize(storage: Storage | null, patch: PopupSize): void {
  try {
    storage?.setItem(POPUP_SIZE_KEY, JSON.stringify({ ...loadPopupSize(storage), ...patch }));
  } catch {
    // không lưu được: chỉ đổi cỡ trong phiên này
  }
}

/** localStorage, hoặc null nếu trình duyệt chặn. */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
