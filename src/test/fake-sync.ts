import type { Attempt } from '../engine/attempt';
import type { RemoteRecord, RemoteSnapshot } from '../sync/merge';
import type { QuestionNotes } from '../notes/model';
import type { AuthClient, RemoteAttempts, RemoteNotes, SignInMethod, SyncUser } from '../sync/types';

export interface FakeRemoteNotes extends RemoteNotes {
  /** Dữ liệu cloud theo uid; write() cũng ghi vào đây. */
  data: Map<string, Map<number, QuestionNotes>>;
  writes: { uid: string; notes: QuestionNotes }[];
  /** Gửi snapshot cho người đang listen uid; bỏ trống thì gửi dữ liệu hiện có trong `data`. */
  emit(uid: string, snapshot?: Map<number, QuestionNotes>): void;
  emitError(uid: string, err: Error): void;
  /** Đặt lỗi thì lần write kế tiếp bị từ chối với lỗi này. */
  writeError: Error | null;
  listening(uid: string): number;
}

export function fakeRemoteNotes(): FakeRemoteNotes {
  const listeners = new Map<string, Set<{ cb: (s: Map<number, QuestionNotes>) => void; onError: (err: Error) => void }>>();
  const remote: FakeRemoteNotes = {
    data: new Map(),
    writes: [],
    writeError: null,
    listen(uid, cb, onError) {
      const set = listeners.get(uid) ?? new Set();
      const entry = { cb, onError };
      set.add(entry);
      listeners.set(uid, set);
      return () => void set.delete(entry);
    },
    async write(uid, notes) {
      remote.writes.push({ uid, notes });
      const err = remote.writeError;
      remote.writeError = null;
      if (err) throw err;
      const records = remote.data.get(uid) ?? new Map();
      records.set(notes.qid, notes);
      remote.data.set(uid, records);
    },
    emit(uid, snapshot) {
      const snap = snapshot ?? remote.data.get(uid) ?? new Map();
      for (const l of [...(listeners.get(uid) ?? [])]) l.cb(new Map(snap));
    },
    emitError(uid, err) {
      for (const l of [...(listeners.get(uid) ?? [])]) l.onError(err);
    },
    listening: (uid) => listeners.get(uid)?.size ?? 0,
  };
  return remote;
}

export interface FakeAuth extends AuthClient {
  emit(user: SyncUser | null): void;
  signInCount: number;
  /** Cách đăng nhập của từng lần signIn. */
  signInMethods: SignInMethod[];
  signOutCount: number;
  /** Đặt lỗi thì lần signIn kế tiếp bị từ chối với lỗi này. */
  signInError: Error | null;
}

/** signOut() giả lập Firebase: báo user = null cho mọi người nghe. */
export function fakeAuth(): FakeAuth {
  const listeners = new Set<(user: SyncUser | null) => void>();
  const auth: FakeAuth = {
    signInCount: 0,
    signInMethods: [],
    signOutCount: 0,
    signInError: null,
    onUserChanged(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    async signIn(method) {
      auth.signInCount += 1;
      auth.signInMethods.push(method);
      const err = auth.signInError;
      auth.signInError = null;
      if (err) throw err;
    },
    async signOut() {
      auth.signOutCount += 1;
      auth.emit(null);
    },
    emit(user) {
      for (const l of [...listeners]) l(user);
    },
  };
  return auth;
}

export interface FakeRemote extends RemoteAttempts {
  /** Dữ liệu cloud theo uid; write() cũng ghi vào đây. */
  data: Map<string, Map<string, RemoteRecord>>;
  writes: { uid: string; attempt: Attempt; updatedAt: number }[];
  /** Gửi snapshot cho người đang listen uid; bỏ trống thì gửi dữ liệu hiện có trong `data`. */
  emit(uid: string, snapshot?: RemoteSnapshot): void;
  /** Báo lỗi listener (ví dụ PERMISSION_DENIED khi chưa publish rules) cho người đang listen uid. */
  emitError(uid: string, err: Error): void;
  setOnline(online: boolean): void;
  /** Giả lập callback '.info/serverTimeOffset': đặt offset, từ đó serverOffsetKnown() = true. */
  setServerOffset(offset: number): void;
  /** Đặt lỗi thì lần write kế tiếp bị từ chối với lỗi này. */
  writeError: Error | null;
  /**
   * Giống SDK: write() báo ngay snapshot có bản vừa ghi cho listener (sự kiện cục bộ); nếu bị
   * từ chối thì báo lại snapshot cũ (revert) trước khi promise reject.
   */
  echo: boolean;
  listening(uid: string): number;
}

/** offset = null: chưa biết offset của server (serverOffsetKnown() = false cho tới setServerOffset). */
export function fakeRemote(offset: number | null = 0): FakeRemote {
  const listeners = new Map<string, Set<{ cb: (s: RemoteSnapshot) => void; onError: (err: Error) => void }>>();
  const connected = new Set<(online: boolean) => void>();
  const offsetListeners = new Set<() => void>();
  let currentOffset = offset ?? 0;
  let offsetKnown = offset !== null;
  const send = (uid: string, snap: RemoteSnapshot) => {
    for (const l of [...(listeners.get(uid) ?? [])]) l.cb(new Map(snap));
  };
  const remote: FakeRemote = {
    data: new Map(),
    writes: [],
    writeError: null,
    echo: false,
    listen(uid, cb, onError) {
      const set = listeners.get(uid) ?? new Set();
      const entry = { cb, onError };
      set.add(entry);
      listeners.set(uid, set);
      return () => void set.delete(entry);
    },
    async write(uid, attempt, updatedAt) {
      remote.writes.push({ uid, attempt, updatedAt });
      const err = remote.writeError;
      remote.writeError = null;
      const before = new Map(remote.data.get(uid) ?? []);
      if (remote.echo) {
        send(uid, new Map(before).set(attempt.id, { attempt, updatedAt }));
        await Promise.resolve(); // server trả lời sau
      }
      if (err) {
        if (remote.echo) send(uid, before);
        throw err;
      }
      const records = remote.data.get(uid) ?? new Map();
      records.set(attempt.id, { attempt, updatedAt });
      remote.data.set(uid, records);
    },
    onConnected(cb) {
      connected.add(cb);
      return () => void connected.delete(cb);
    },
    serverOffset: () => currentOffset,
    serverOffsetKnown: () => offsetKnown,
    onServerOffset(cb) {
      offsetListeners.add(cb);
      return () => void offsetListeners.delete(cb);
    },
    emit(uid, snapshot) {
      send(uid, snapshot ?? remote.data.get(uid) ?? new Map());
    },
    emitError(uid, err) {
      for (const l of [...(listeners.get(uid) ?? [])]) l.onError(err);
    },
    setOnline(online) {
      for (const l of [...connected]) l(online);
    },
    setServerOffset(value) {
      currentOffset = value;
      offsetKnown = true;
      for (const l of [...offsetListeners]) l();
    },
    listening: (uid) => listeners.get(uid)?.size ?? 0,
  };
  return remote;
}
