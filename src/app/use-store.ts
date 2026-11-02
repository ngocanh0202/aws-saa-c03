import { useSyncExternalStore } from 'react';
import { useApp } from './context';

const noSubscribe = () => () => {};
const alwaysReady = () => true;

/** Vẽ lại trang khi store đổi (lưu cục bộ, đồng bộ từ máy khác, đổi viewer). */
export function useStoreVersion(): number {
  const { store } = useApp();
  return useSyncExternalStore(store.subscribe, store.version);
}

/** now() đã đáng tin để chốt lượt Thi thật hết giờ (xem SyncController.clockReady); không có Firebase thì luôn true. */
export function useClockReady(): boolean {
  const { sync } = useApp();
  return useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.clockReady ?? alwaysReady);
}
