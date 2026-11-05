import type { AttemptStore, StoreEntry } from '../storage/storage';
import { authErrorMessage } from './auth-messages';
import { findGuestConflicts, planSync, type RemoteSnapshot } from './merge';
import type { AuthClient, RemoteAttempts, SyncController, SyncState, SyncUser } from './types';

/** Một phiên đăng nhập: hủy phiên thì mọi callback cũ của nó bị bỏ qua. */
interface Session {
  user: SyncUser;
  /** Snapshot mới nhất (giữ lại khi đang loading/conflict để dùng lúc người dùng chọn). */
  snapshot: RemoteSnapshot | null;
  unlisten: () => void;
  unsubscribeSave: (() => void) | null;
  /** Số lần ghi lên cloud chưa xong của phiên này. */
  pending: number;
  /** Số lần ghi chưa xong theo id: snapshot đến trong lúc này (echo/revert của SDK) không đẩy lại id đó. */
  inFlight: Map<string, number>;
  /** Id có lần ghi bị từ chối: snapshot sau không đẩy lại (tránh vòng lặp) cho tới khi save() id đó lần nữa. */
  rejected: Set<string>;
}


export function createSyncController(deps: {
  store: AttemptStore;
  auth: AuthClient;
  remote: RemoteAttempts;
}): SyncController {
  const { store, auth, remote } = deps;
  const listeners = new Set<() => void>();
  let state: SyncState = { kind: 'initializing' };
  let session: Session | null = null;
  /** User auth báo gần nhất (vẫn còn khi phiên bị hủy vì lỗi đọc cloud). */
  let currentUser: SyncUser | null = null;
  let online = true;

  // Chỉ thay tham chiếu `state` khi thật sự đổi (useSyncExternalStore so bằng ===).
  const setState = (next: SyncState) => {
    state = next;
    for (const l of [...listeners]) l();
  };
  const setSynced = (s: Session) => setState({ kind: 'synced', user: s.user, online, pending: s.pending });

  const write = (s: Session, entry: StoreEntry) => {
    const id = entry.attempt.id;
    s.pending += 1;
    s.inFlight.set(id, (s.inFlight.get(id) ?? 0) + 1);
    // Trong start() state chưa là 'synced'; start() tự đặt state sau khi ghi xong hết.
    if (state.kind === 'synced') setSynced(s);
    remote.write(s.user.uid, entry.attempt, entry.meta.updatedAt).then(
      () => {
        s.rejected.delete(id);
        settle(s, id);
      },
      (err: unknown) => {
        console.error('Không ghi được lượt thi lên cloud', err);
        s.rejected.add(id);
        settle(s, id);
      },
    );
  };
  const settle = (s: Session, id: string) => {
    s.pending -= 1;
    const left = (s.inFlight.get(id) ?? 1) - 1;
    if (left > 0) s.inFlight.set(id, left);
    else s.inFlight.delete(id);
    if (session === s && state.kind === 'synced') setSynced(s);
  };

  // Áp dụng snapshot theo quy tắc gộp: cloud → máy (put), máy → cloud (write).
  // Không đẩy lại id đang ghi dở hoặc vừa bị từ chối: SDK báo lại snapshot cũ khi server từ chối.
  const applySnapshot = (s: Session, snap: RemoteSnapshot) => {
    const plan = planSync(store.entries(), snap, s.user.uid);
    for (const entry of plan.apply) store.put(entry);
    for (const entry of plan.push) {
      const id = entry.attempt.id;
      if (!s.inFlight.has(id) && !s.rejected.has(id)) write(s, entry);
    }
  };

  const start = (s: Session, snap: RemoteSnapshot) => {
    store.setViewer(s.user.uid);
    applySnapshot(s, snap);
    s.unsubscribeSave = store.onSave((entry) => {
      if (session !== s || entry.meta.owner !== s.user.uid) return;
      s.rejected.delete(entry.attempt.id);
      write(s, entry);
    });
    setSynced(s);
  };

  const onSnapshot = (s: Session, snap: RemoteSnapshot) => {
    if (session !== s) return;
    s.snapshot = snap;
    if (state.kind === 'loading') {
      // Lần đọc cloud đầu tiên: có lượt thi khách khác cloud thì hỏi trước, chưa ghi gì.
      const conflicts = findGuestConflicts(store.entries(), snap);
      if (conflicts.length > 0) setState({ kind: 'conflict', user: s.user, count: conflicts.length });
      else start(s, snap);
    } else if (state.kind === 'synced') {
      applySnapshot(s, snap);
    }
  };

  const teardown = () => {
    if (!session) return;
    session.unlisten();
    session.unsubscribeSave?.();
    session = null;
    store.setViewer(null);
  };

  // Không đọc được cloud (thường do chưa publish rules): hủy phiên, giữ user của auth để bấm lại thì thử lại.
  const onListenError = (s: Session, err: Error) => {
    if (session !== s) return;
    console.error('Không đọc được dữ liệu trên cloud', err);
    teardown();
    setState({
      kind: 'error',
      message: `Không đọc được dữ liệu trên cloud (kiểm tra Security Rules trong docs/firebase-setup.md): ${err.message}`,
    });
  };

  const openSession = (user: SyncUser) => {
    // Chưa setViewer: lượt thi khách vẫn hiện cho tới khi giải quyết xong xung đột.
    const s: Session = {
      user,
      snapshot: null,
      unlisten: () => {},
      unsubscribeSave: null,
      pending: 0,
      inFlight: new Map(),
      rejected: new Set(),
    };
    session = s;
    setState({ kind: 'loading', user });
    s.unlisten = remote.listen(
      user.uid,
      (snap) => onSnapshot(s, snap),
      (err) => onListenError(s, err),
    );
  };

  auth.onUserChanged((user) => {
    currentUser = user;
    if (user && session && session.user.uid === user.uid) return;
    teardown();
    if (!user) {
      setState({ kind: 'signed-out' });
      return;
    }
    openSession(user);
  });

  remote.onConnected((value) => {
    if (value === online) return;
    online = value;
    if (session && state.kind === 'synced') setSynced(session);
  });

  // clockReady() có thể vừa đổi: báo người nghe (getState giữ nguyên tham chiếu).
  remote.onServerOffset(() => {
    for (const l of [...listeners]) l();
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    async signIn(method = { kind: 'google' }) {
      if (state.kind === 'error' && currentUser && !session) {
        openSession(currentUser);
        return;
      }
      if (state.kind !== 'signed-out' && state.kind !== 'error') return;
      if (state.kind === 'error') setState({ kind: 'signed-out' });
      try {
        await auth.signIn(method);
      } catch (err) {
        if (method.kind === 'email') throw new Error(authErrorMessage(err));
        // Phiên đã mở trong lúc chờ (onUserChanged chạy trước) thì không đè lỗi lên.
        if (state.kind === 'signed-out') setState({ kind: 'error', message: authErrorMessage(err) });
      }
    },
    async signOut() {
      try {
        await auth.signOut();
      } catch (err) {
        console.error('Không đăng xuất được', err);
      }
    },
    resolveConflict(choice) {
      const s = session;
      if (!s || state.kind !== 'conflict' || !s.snapshot) return;
      const snap = s.snapshot;
      const ids = new Set(findGuestConflicts(store.entries(), snap));
      if (choice === 'cloud') {
        store.remove([...ids]);
      } else {
        for (const { attempt, meta } of store.entries()) {
          if (!ids.has(attempt.id)) continue;
          const r = snap.get(attempt.id);
          // Trùng id với cloud thì giữ bản cloud; không thì gắn owner để start() đẩy lên.
          store.put(
            r
              ? { attempt: r.attempt, meta: { owner: s.user.uid, updatedAt: r.updatedAt } }
              : { attempt, meta: { owner: s.user.uid, updatedAt: meta.updatedAt } },
          );
        }
      }
      start(s, snap);
    },
    serverOffset: () => (session ? remote.serverOffset() : 0),
    clockReady: () =>
      state.kind === 'signed-out' || state.kind === 'error' || (session !== null && remote.serverOffsetKnown()),
  };
}
