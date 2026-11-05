import type { Attempt } from '../engine/attempt';
import type { RemoteSnapshot } from './merge';

export interface SyncUser {
  uid: string;
  name: string;
  photoURL?: string;
}

/** Cách đăng nhập: Google/Facebook mở cửa sổ của nhà cung cấp; email dùng form của web. */
export type SignInMethod =
  | { kind: 'google' }
  | { kind: 'facebook' }
  | { kind: 'email'; mode: 'sign-in' | 'sign-up'; email: string; password: string };

export interface AuthClient {
  onUserChanged(cb: (user: SyncUser | null) => void): () => void;
  /** Người dùng tự đóng cửa sổ Google/Facebook thì resolve, không ném lỗi. */
  signIn(method: SignInMethod): Promise<void>;
  signOut(): Promise<void>;
}

export interface RemoteAttempts {
  /** Snapshot đầy đủ mỗi lần (onValue); onError khi bị hủy (ví dụ rules từ chối đọc). */
  listen(uid: string, cb: (snapshot: RemoteSnapshot) => void, onError: (err: Error) => void): () => void;
  write(uid: string, attempt: Attempt, updatedAt: number): Promise<void>;
  onConnected(cb: (online: boolean) => void): () => void;
  serverOffset(): number;
  /** true sau khi '.info/serverTimeOffset' báo giá trị lần đầu. */
  serverOffsetKnown(): boolean;
  /** Gọi mỗi khi offset của server được báo. */
  onServerOffset(cb: () => void): () => void;
}

export type SyncState =
  /** Chưa biết đã đăng nhập hay chưa (trước lần báo đầu tiên của auth). */
  | { kind: 'initializing' }
  | { kind: 'signed-out' }
  | { kind: 'loading'; user: SyncUser }
  | { kind: 'conflict'; user: SyncUser; count: number }
  | { kind: 'synced'; user: SyncUser; online: boolean; pending: number }
  | { kind: 'error'; message: string };

export interface SyncController {
  /** Giữ nguyên tham chiếu cho tới khi state đổi (dùng cho useSyncExternalStore). */
  getState(): SyncState;
  subscribe(listener: () => void): () => void;
  /**
   * Lỗi (popup bị chặn…) → state 'error' với thông báo tiếng Việt; bấm lại thì quay về 'signed-out' rồi thử lại.
   * Ở 'error' mà auth vẫn còn user (lỗi đọc cloud) thì mở lại phiên cho user đó, không mở popup.
   * Mặc định Google. Email: lỗi không đổi state mà ném Error có câu báo tiếng Việt để form hiện.
   */
  signIn(method?: SignInMethod): Promise<void>;
  signOut(): Promise<void>;
  resolveConflict(choice: 'cloud' | 'push'): void;
  /** Offset theo server khi có phiên đăng nhập; không có phiên thì 0 (khách dùng Date.now()). */
  serverOffset(): number;
  /**
   * now() đã đáng tin để chốt lượt Thi thật hết giờ: không có phiên (signed-out/error) hoặc đã
   * biết offset của server. Người nghe subscribe được báo khi giá trị này có thể đã đổi.
   */
  clockReady(): boolean;
}
