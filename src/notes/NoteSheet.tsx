import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from '../components/icons';
import { useMobile } from './use-mobile';
import { usePopupResize } from './usePopupResize';

export interface NoteSheetProps {
  title: ReactNode;
  ariaLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Khung ghi chú: popup giữa màn hình trên máy tính; điện thoại là bottom sheet có thanh kéo đổi cỡ
 * (kéo xuống quá cỡ nhỏ nhất thì đóng). Esc đóng, trừ khi bên trong đã xử lý (preventDefault). Gắn vào body.
 */
export function NoteSheet({ title, ariaLabel, onClose, children }: NoteSheetProps) {
  const mobile = useMobile();
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

  // Gắn vào body: nút mở có thể nằm trong khối nổi (.exam-dock) có stacking context riêng.
  return createPortal(
    <div className="dialog note-sheet" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="dialog__box note-sheet__box" style={mobile ? resize.style : undefined} role="dialog" aria-modal="true" aria-label={ariaLabel}>
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
          <button type="button" className="icon-btn" aria-label="Đóng" title="Đóng" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <div className="note-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
