import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import type { SyncController } from '../sync/types';

function Dialog({ sync }: { sync: SyncController }) {
  const state = useSyncExternalStore(sync.subscribe, sync.getState);
  const first = useRef<HTMLButtonElement>(null);
  const open = state.kind === 'conflict';
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  if (state.kind !== 'conflict') return null;
  return (
    <div className="dialog">
      <div className="dialog__box" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
        <h2 id="conflict-title">Máy này có dữ liệu chưa đăng nhập</h2>
        <p>{`Có ${state.count} lượt thi trên máy này chưa thuộc tài khoản ${state.user.name}. Bạn muốn xử lý thế nào?`}</p>
        <div className="row">
          <button ref={first} type="button" onClick={() => sync.resolveConflict('cloud')}>
            Dùng dữ liệu trên cloud
          </button>
          <button type="button" className="btn-primary" onClick={() => sync.resolveConflict('push')}>
            Đưa dữ liệu trên máy này lên tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConflictDialog() {
  const { sync } = useApp();
  return sync ? <Dialog sync={sync} /> : null;
}
