import { useCallback, useState } from 'react';
import type { ServiceRef } from '../data/types';
import { ServiceModal } from './ServiceModal';

/** Chip service trong hướng dẫn: mở popup ghi chú service thay vì chuyển trang. */
export function ServiceChip({ id, service }: { id: string; service?: ServiceRef }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className="chip" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {service?.name ?? id}
      </button>
      {open && <ServiceModal id={id} onClose={close} />}
    </>
  );
}
