import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from '../components/icons';
import { useMobile } from './use-mobile';
import { clampSplit, loadSplit, saveSplit, SPLIT_STEP } from './split-size';
import { usePopupResize } from './usePopupResize';

export interface NoteSheetProps {
  title: ReactNode;
  ariaLabel: string;
  onClose: () => void;
  /** Khung nổi ở góc như khung chat (trang vẫn dùng được), có nút Mở rộng; điện thoại vẫn là bottom sheet. */
  docked?: boolean;
  children: ReactNode;
}

/** Các khung đang mở theo thứ tự mở; Esc chỉ đóng khung trên cùng (popup "Ghi chú mới" nằm trên khung chính). */
const stack: string[] = [];

const browserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * Khung ghi chú. Mặc định là popup giữa màn hình (máy tính); `docked` thì nổi ở góc dưới bên phải như khung
 * chat (không lớp nền, không modal, không đổi bố cục trang), Mở rộng thì thành cột 30% bên phải và trang
 * thu còn 70% (CSS chừa lề phải cho body); thanh kéo ở mép trái cột đổi tỉ lệ (20%–60%, nhớ cho lần sau). Điện thoại: bottom sheet có thanh kéo đổi cỡ (kéo xuống quá cỡ nhỏ nhất thì đóng). Esc đóng, trừ khi bên trong đã xử lý (preventDefault).
 * Gắn vào body. Đổi kiểu hiển thị chỉ đổi class, nên chữ đang gõ trong khung không mất.
 */
export function NoteSheet({ title, ariaLabel, onClose, docked = false, children }: NoteSheetProps) {
  const mobile = useMobile();
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pressedBackdrop = useRef(false);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  const resize = usePopupResize({ ref, openKey: `note-sheet:${mobile ? 'm' : 'd'}`, mobile, onDismiss: () => close.current() });

  const id = useId();
  // Khung mở sau (popup "Ghi chú mới") nằm trên khung mở trước, kể cả khi cả hai là bottom sheet.
  const [depth] = useState(() => stack.length);
  useEffect(() => {
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && stack[stack.length - 1] === id) {
        e.preventDefault();
        close.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
    };
  }, [id]);

  // Phóng to: cột bên phải (mặc định 30%), trang (câu hỏi) chiếm phần còn lại; vẫn không modal như khung ở góc.
  const variant = mobile ? 'sheet' : docked ? (expanded ? 'split' : 'dock') : 'center';
  const modal = variant === 'sheet' || variant === 'center';
  const z = modal ? 80 + depth * 2 : undefined;
  const split = variant === 'split';
  const [ratio, setRatio] = useState(() => loadSplit(browserStorage()));
  // Tỉ lệ đặt ở :root để CSS chừa đúng lề phải cho trang.
  useEffect(() => {
    if (!split) return;
    const root = document.documentElement.style;
    root.setProperty('--note-split', `${Math.round(ratio * 100)}vw`);
    return () => void root.removeProperty('--note-split');
  }, [split, ratio]);
  const changeRatio = (r: number, persist: boolean) => {
    const next = clampSplit(r);
    setRatio(next);
    if (persist) saveSplit(browserStorage(), next);
  };
  const drag = useRef<number | null>(null);
  // Đang kéo: CSS tắt hiệu ứng co giãn của trang để trang bám theo tay ngay.
  const setDragging = (on: boolean) => {
    if (on) document.documentElement.setAttribute('data-note-drag', '');
    else document.documentElement.removeAttribute('data-note-drag');
  };
  useEffect(() => () => setDragging(false), []);
  const viewportW = () => document.documentElement.clientWidth || window.innerWidth;
  const grip = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button > 0) return;
      e.preventDefault();
      drag.current = e.pointerId;
      setDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      if (drag.current !== e.pointerId) return;
      changeRatio((viewportW() - e.clientX) / viewportW(), false);
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      if (drag.current !== e.pointerId) return;
      drag.current = null;
      setDragging(false);
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      changeRatio((viewportW() - e.clientX) / viewportW(), true);
    },
    onPointerCancel() {
      drag.current = null;
      setDragging(false);
    },
    onKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
      // Thanh ở mép trái cột: mũi tên trái nới rộng cột ghi chú, mũi tên phải thu hẹp.
      const d = e.key === 'ArrowLeft' ? SPLIT_STEP : e.key === 'ArrowRight' ? -SPLIT_STEP : 0;
      if (!d) return;
      e.preventDefault();
      changeRatio(ratio + d, true);
    },
  };

  return createPortal(
    <>
      <div
        ref={ref}
        className={`note-sheet note-sheet--${variant}`}
        style={{ ...(mobile ? resize.style : {}), ...(z !== undefined ? { zIndex: z } : {}) }}
        role="dialog"
        aria-modal={modal || undefined}
        aria-label={ariaLabel}
        onPointerDownCapture={() => (pressedBackdrop.current = false)}
      >
        {split && (
          <div
            className="note-sheet__split-grip"
            role="separator"
            aria-orientation="vertical"
            aria-label="Kéo để đổi độ rộng cột ghi chú"
            title="Kéo để đổi độ rộng cột ghi chú"
            aria-valuemin={20}
            aria-valuemax={60}
            aria-valuenow={Math.round(ratio * 100)}
            tabIndex={0}
            {...grip}
          />
        )}
        {mobile && (
          <div
            className="hl-sheet__grab note-sheet__grab"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Kéo để đổi cỡ khung ghi chú"
            title="Kéo để đổi cỡ khung ghi chú"
            tabIndex={0}
            {...resize.handlers}
          />
        )}
        <div className="note-sheet__head">
          <h2 className="note-form__title">{title}</h2>
          {docked && !mobile && (
            <button
              type="button"
              className="icon-btn"
              aria-label={expanded ? 'Thu nhỏ' : 'Mở rộng'}
              title={expanded ? 'Thu nhỏ' : 'Mở rộng (chia đôi màn hình với câu hỏi)'}
              onClick={() => setExpanded((x) => !x)}
            >
              {expanded ? '⤡' : '⤢'}
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Đóng" title="Đóng" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <div className="note-sheet__body">{children}</div>
      </div>
      {/* Đứng sau khung để khung giữ nguyên vị trí trong cây (không mount lại) khi lớp nền bật/tắt. */}
      {modal && (
        <div
          className="note-sheet__backdrop"
          style={{ zIndex: z! - 1 }}
          // Chỉ đóng khi bấm hẳn vào nền: bôi chọn chữ trong ô rồi thả chuột ra ngoài không làm mất chữ đang gõ.
          onPointerDown={(e) => (pressedBackdrop.current = e.target === e.currentTarget)}
          onClick={(e) => {
            if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
            pressedBackdrop.current = false;
          }}
        />
      )}
    </>,
    document.body,
  );
}
