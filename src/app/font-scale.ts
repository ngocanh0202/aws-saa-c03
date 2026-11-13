import { useEffect, useState } from 'react';

/** Cỡ chữ trên điện thoại (hệ số nhân cỡ chữ gốc), nhớ trên máy; CSS chỉ dùng --font-scale dưới 640px. */
export const FONT_SCALE_KEY = 'saa-c03:font-scale:v1';
export const FONT_SCALES = [0.85, 0.9, 1, 1.1, 1.2, 1.3] as const;
const DEFAULT = 1;

export function loadFontScale(storage: Storage | null): number {
  try {
    const v = Number(storage?.getItem(FONT_SCALE_KEY));
    return (FONT_SCALES as readonly number[]).includes(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function saveFontScale(storage: Storage | null, scale: number): void {
  try {
    storage?.setItem(FONT_SCALE_KEY, String(scale));
  } catch {
    // không lưu được: chỉ đổi trong phiên này
  }
}

/** Mức kế tiếp theo hướng `dir` (+1 to hơn, -1 nhỏ hơn); ở đầu danh sách thì giữ nguyên. */
export function stepFontScale(scale: number, dir: 1 | -1): number {
  const list = FONT_SCALES as readonly number[];
  const i = Math.max(0, list.indexOf(scale));
  return list[Math.min(list.length - 1, Math.max(0, i + dir))];
}

export function applyFontScale(scale: number): void {
  const root = document.documentElement.style;
  if (scale === DEFAULT) root.removeProperty('--font-scale');
  else root.setProperty('--font-scale', String(scale));
}

const browserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const listeners = new Set<(s: number) => void>();

/** Cỡ chữ hiện tại; đổi ở một chỗ thì mọi nơi dùng hook cùng cập nhật. Áp dụng lên :root khi mount. */
export function useFontScale(): [number, (dir: 1 | -1) => void] {
  const [scale, setScale] = useState(() => loadFontScale(browserStorage()));
  useEffect(() => {
    applyFontScale(scale);
  }, [scale]);
  useEffect(() => {
    listeners.add(setScale);
    return () => void listeners.delete(setScale);
  }, []);
  const step = (dir: 1 | -1) => {
    const next = stepFontScale(scale, dir);
    saveFontScale(browserStorage(), next);
    for (const l of [...listeners]) l(next);
  };
  return [scale, step];
}
