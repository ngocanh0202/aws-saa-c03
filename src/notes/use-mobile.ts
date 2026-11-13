import { useEffect, useState } from 'react';

/** Điện thoại: popup ghi chú thành bottom sheet. */
export const MOBILE_QUERY = '(max-width: 639px)';

/** true khi màn hình khớp `query` (mặc định là điện thoại); theo dõi khi đổi cỡ. */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia?.(query)?.matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    setMatch(mq.matches);
    const on = () => setMatch(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return match;
}

export const useMobile = (): boolean => useMediaQuery(MOBILE_QUERY);
