import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from '../components/icons';
import { useMobile } from './use-mobile';
import { usePopupResize } from './usePopupResize';

export interface NoteSheetProps {
  title: ReactNode;
  ariaLabel: string;
  onClose: () => void;
  /** Khung nổi ở góc như khung chat (trang vẫn dùng được), có nút Mở rộng; điện thoại vẫn là bottom sheet. */
  docked?: boolean;
  children: ReactNode;
}

/**
 * Khung ghi chú. Mặc định là popup giữa màn hình (máy tính); `docked` thì nổi ở góc dưới bên phải như khung
 * chat (không lớp nền, không modal), Mở rộng thì phủ toàn màn hình. Điện thoại: bottom sheet có thanh kéo
 * đổi cỡ (kéo xuống quá cỡ nhỏ nhất thì đóng). Esc đóng, trừ khi bên trong đã xử lý (preventDefault).
 * Gắn vào body. Đổi kiểu hiển thị chỉ đổi class, nên chữ đang gõ trong khung không mất.
 */
export function NoteSheet({ title, ariaLabel, onClose, docked = false, children }: NoteSheetProps) {
  const mobile = useMobile();
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  const resize = usePopupResize({ ref, openKey: `note-sheet:${mobile ? 'm' : 'd'}`, mobile, onDismiss: () => close.current() });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const variant = mobile ? 'sheet' : expanded ? 'full' : docked ? 'dock' : 'center';
  const modal = variant !== 'dock';

  return createPortal(
    <>
      <div
        ref={ref}
        className={`note-sheet note-sheet--${variant}`}
        style={mobile ? resize.style : undefined}
        role="dialog"
        aria-modal={modal || undefined}
        aria-label={ariaLabel}
      >
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
              title={expanded ? 'Thu nhỏ' : 'Mở rộng toàn màn hình'}
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
      {modal && <div className="note-sheet__backdrop" onClick={onClose} />}
    </>,
    document.body,
  );
}
