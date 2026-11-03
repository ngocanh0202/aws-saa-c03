import { useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import type { SyncController } from '../sync/types';

const TEXT = 'Đang đồng bộ dữ liệu với tài khoản Google…';

function Overlay({ sync }: { sync: SyncController }) {
  const state = useSyncExternalStore(sync.subscribe, sync.getState);
  // Chỉ phủ lúc tải dữ liệu cloud của user vừa đăng nhập; khách không bao giờ thấy.
  if (state.kind !== 'loading') return null;
  return (
    <div className="sync-loading" role="status" aria-label={TEXT}>
      <div className="sync-loading__box">
        <span className="sync-loading__spinner" aria-hidden="true" />
        <p>{TEXT}</p>
      </div>
    </div>
  );
}

export function SyncLoading() {
  const { sync } = useApp();
  return sync ? <Overlay sync={sync} /> : null;
}
