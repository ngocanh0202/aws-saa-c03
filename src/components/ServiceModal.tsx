import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../app/context';
import { ServiceNoteView } from './ServiceNoteView';

/**
 * Popup toàn màn hình hiện ghi chú service, trông như một trang riêng nhưng không rời trang
 * hiện tại (đang thi vẫn giữ nguyên bài). Nút đóng góc trên bên phải được focus và nhấp nháy
 * vài lần để người dùng biết cách quay lại.
 */
export function ServiceModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { bank } = useApp();
  const service = bank.services.get(id);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Khóa cuộn trang phía sau, trả lại như cũ khi đóng.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="service-modal" role="dialog" aria-modal="true" aria-labelledby="service-modal-title" lang="vi">
      <header className="service-modal__bar">
        <div className="service-modal__title">
          <h1 id="service-modal-title">{service?.name ?? id}</h1>
          {service && <p className="hint">{service.category}</p>}
        </div>
        <button ref={closeRef} type="button" className="service-modal__close" aria-label="Đóng" title="Đóng (Esc)" onClick={onClose}>
          ✕ Đóng
        </button>
      </header>
      <div className="service-modal__body">
        <div className="page">
          <ServiceNoteView note={bank.serviceNotes.get(id)} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
