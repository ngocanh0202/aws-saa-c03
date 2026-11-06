import type { ErrorReport, SupportMessage, SupportThread } from './model';

export interface SupportStore {
  /** Tin của một cuộc trò chuyện, theo thứ tự `at`; gọi lại mỗi khi đổi. */
  listenThread(uid: string, cb: (messages: SupportMessage[]) => void, onError: (e: Error) => void): () => void;
  /** Bản ghi supportIndex của chính uid (null nếu chưa có) — cho chấm chưa đọc. */
  listenOwnIndex(uid: string, cb: (thread: SupportThread | null) => void): () => void;
  /** Admin: mọi cuộc trò chuyện, mới nhất trước. */
  listenInbox(cb: (threads: SupportThread[]) => void, onError: (e: Error) => void): () => void;
  /** Ghi tin + cập nhật supportIndex/{uid} trong một update nhiều đường dẫn. */
  send(uid: string, msg: { from: 'user' | 'admin'; text: string; error?: ErrorReport }, who: { name: string; email?: string }): Promise<void>;
  /** Đặt unreadByUser/unreadByAdmin = false (đường dẫn con); bỏ qua nếu chưa có bản ghi. */
  markRead(uid: string, reader: 'user' | 'admin'): Promise<void>;
}
