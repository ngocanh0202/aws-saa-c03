import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { browserStorage, clamp, DISMISS_PX, EDGE, KEY_STEP_PX, KEY_STEP_VH, loadPopupSize, savePopupSize, SHEET_MAX_VH } from './popup-size';

interface Size {
  /** Lần mở popup mà cỡ này thuộc về; khác lần mở hiện tại thì popup dùng cỡ mặc định. */
  key: string;
  w?: number;
  h: number;
}

interface Drag {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Chiều cao chưa kẹp (điện thoại): kéo xuống quá cỡ nhỏ nhất thì đóng. */
  raw?: number;
  last?: Size;
}

export interface PopupResizeOptions {
  ref: RefObject<HTMLElement | null>;
  /** Khóa của lần mở (đoạn tô + loại máy); null khi đóng. */
  openKey: string | null;
  mobile: boolean;
  /** Điện thoại: kéo thanh xuống quá cỡ nhỏ nhất thì đóng (cùng đường với nút Đóng để tự lưu). */
  onDismiss: () => void;
}

const viewportW = () => document.documentElement.clientWidth || window.innerWidth;

/**
 * Đổi cỡ popup ghi chú. Máy tính: góc phải dưới, đổi rộng và cao, không vượt mép màn hình.
 * Điện thoại: thanh kéo trên đỉnh sheet, đổi cao tới 90vh. Cỡ nhỏ nhất là cỡ mặc định lúc mở.
 */
export function usePopupResize({ ref, openKey, mobile, onDismiss }: PopupResizeOptions) {
  const [size, setSize] = useState<Size | null>(null);
  const cur = size && openKey && size.key === openKey ? size : null;
  const min = useRef({ w: 0, h: 0 });
  const drag = useRef<Drag | null>(null);
  const dismiss = useRef(onDismiss);
  useLayoutEffect(() => {
    dismiss.current = onDismiss;
  });

  const fit = (key: string, w: number, h: number, r: DOMRect): Size => {
    if (mobile) return { key, h: Math.round(clamp(h, min.current.h, window.innerHeight * SHEET_MAX_VH)) };
    return {
      key,
      w: Math.round(clamp(w, min.current.w, viewportW() - EDGE - r.left)),
      h: Math.round(clamp(h, min.current.h, window.innerHeight - EDGE - r.top)),
    };
  };

  const save = (s: Size) => savePopupSize(browserStorage(), mobile ? { mobile: { h: s.h } } : { desktop: { w: s.w!, h: s.h } });

  // Mở popup: đo cỡ mặc định (chưa áp cỡ riêng) làm cỡ nhỏ nhất, rồi áp cỡ đã lưu.
  useLayoutEffect(() => {
    drag.current = null;
    const el = ref.current;
    if (!openKey) return setSize(null);
    if (!el) return;
    const r = el.getBoundingClientRect();
    min.current = { w: r.width, h: r.height };
    const saved = loadPopupSize(browserStorage());
    if (mobile && saved.mobile) setSize(fit(openKey, 0, saved.mobile.h, r));
    else if (!mobile && saved.desktop) setSize(fit(openKey, saved.desktop.w, saved.desktop.h, r));
  }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveTo = (d: Drag, x: number, y: number, el: HTMLElement) => {
    if (!openKey) return;
    if (mobile) d.raw = d.h + (d.y - y);
    const next = fit(openKey, d.w + (x - d.x), mobile ? d.raw! : d.h + (y - d.y), el.getBoundingClientRect());
    d.last = next;
    setSize(next);
  };

  const handlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      const el = ref.current;
      if (!el || e.button > 0) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== e.pointerId || !ref.current) return;
      moveTo(d, e.clientX, e.clientY, ref.current);
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== e.pointerId || !ref.current) return;
      moveTo(d, e.clientX, e.clientY, ref.current);
      drag.current = null;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (mobile && d.raw !== undefined && d.raw < min.current.h - DISMISS_PX) return dismiss.current();
      if (d.last) save(d.last);
    },
    onPointerCancel() {
      drag.current = null;
    },
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      const el = ref.current;
      if (!el || !openKey) return;
      const step = mobile ? window.innerHeight * KEY_STEP_VH : KEY_STEP_PX;
      const delta: Record<string, [number, number]> = mobile
        ? { ArrowUp: [0, step], ArrowDown: [0, -step] }
        : { ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowDown: [0, step], ArrowUp: [0, -step] };
      const dd = delta[e.key];
      if (!dd) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const next = fit(openKey, r.width + dd[0], r.height + dd[1], r);
      setSize(next);
      save(next);
    },
  };

  let style: CSSProperties = {};
  if (cur) style = mobile ? { height: cur.h, maxHeight: `${SHEET_MAX_VH * 100}vh` } : { width: cur.w, height: cur.h };
  return { style, handlers };
}
