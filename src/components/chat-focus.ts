/** Chỉ một khung chat mở tại một thời điểm: khung nào mở thì báo các khung khác đóng lại. */
const listeners = new Set<(id: string) => void>();

/** Khung `id` vừa mở: mọi người nghe (kể cả chính nó, tự lọc theo id) được báo. */
export function claimChatFocus(id: string): void {
  for (const l of [...listeners]) l(id);
}

/** Đăng ký nghe; trả về hàm hủy. */
export function onChatFocus(listener: (id: string) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
