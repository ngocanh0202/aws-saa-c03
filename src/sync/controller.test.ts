import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Attempt } from '../engine/attempt';
import { createStore, type AttemptStore } from '../storage/storage';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { memoryStorage } from '../test/fixtures';
import { createSyncController } from './controller';
import type { RemoteSnapshot } from './merge';
import type { SyncUser } from './types';

function att(id: string, status: Attempt['status'] = 'in-progress', extra: Partial<Attempt> = {}): Attempt {
  return {
    id,
    setId: 1,
    mode: 'practice',
    seed: 1,
    esl: true,
    startedAt: 100,
    questions: [],
    answers: {},
    flagged: [],
    guideOpened: [],
    status,
    ...extra,
  };
}
const snap = (...items: Array<[Attempt, number]>): RemoteSnapshot =>
  new Map(items.map(([attempt, updatedAt]) => [attempt.id, { attempt, updatedAt }]));

const A: SyncUser = { uid: 'uA', name: 'An' };
const B: SyncUser = { uid: 'uB', name: 'Bình' };
const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const ids = (store: AttemptStore) => store.list().map((a) => a.id).sort();

function setup(storage: Storage = memoryStorage(), offset: number | null = 42) {
  let t = 1000;
  const store = createStore(storage, { now: () => ++t });
  const auth = fakeAuth();
  const remote = fakeRemote(offset);
  const ctl = createSyncController({ store, auth, remote });
  return { storage, store, auth, remote, ctl };
}

afterEach(() => vi.restoreAllMocks());

describe('createSyncController', () => {
  it('máy không có dữ liệu khách: đăng nhập là đồng bộ ngay, dữ liệu cloud vào store', () => {
    const { store, auth, remote, ctl } = setup();
    expect(ctl.getState()).toEqual({ kind: 'initializing' });
    auth.emit(A);
    expect(ctl.getState()).toEqual({ kind: 'loading', user: A });
    remote.emit(A.uid, snap([att('c1', 'submitted'), 50]));
    expect(ctl.getState()).toEqual({ kind: 'synced', user: A, online: true, pending: 0 });
    expect(ids(store)).toEqual(['c1']);
    expect(store.entries()[0].meta).toEqual({ owner: A.uid, updatedAt: 50 });
    expect(remote.writes).toEqual([]);
    expect(ctl.serverOffset()).toBe(42);
  });

  it('có lượt thi khách: vào trạng thái conflict với count đúng và chưa đổi gì', () => {
    const { store, auth, remote, ctl } = setup();
    store.save(att('g1'));
    store.save(att('g2'));
    const before = JSON.stringify(store.entries());
    auth.emit(A);
    remote.emit(A.uid, snap([att('c1'), 50]));
    expect(ctl.getState()).toEqual({ kind: 'conflict', user: A, count: 2 });
    expect(JSON.stringify(store.entries())).toBe(before);
    expect(remote.writes).toEqual([]);
    // Snapshot tiếp theo khi đang conflict cũng không ghi gì.
    remote.emit(A.uid, snap([att('c1'), 50], [att('c2'), 60]));
    expect(JSON.stringify(store.entries())).toBe(before);
    expect(remote.writes).toEqual([]);
  });

  it('tải lại trang trước khi chọn: store không đổi, controller mới lại báo conflict', () => {
    const first = setup();
    first.store.save(att('g1'));
    first.auth.emit(A);
    first.remote.emit(A.uid, snap([att('c1'), 50]));
    expect(first.ctl.getState().kind).toBe('conflict');

    const second = setup(first.storage);
    expect(second.store.entries().map((e) => e.attempt.id)).toEqual(['g1']);
    second.auth.emit(A);
    second.remote.emit(A.uid, snap([att('c1'), 50]));
    expect(second.ctl.getState()).toEqual({ kind: 'conflict', user: A, count: 1 });
  });

  it('chọn cloud: lượt thi khách bị xóa, chỉ còn dữ liệu cloud', () => {
    const { store, auth, remote, ctl } = setup();
    store.save(att('g1'));
    auth.emit(A);
    remote.emit(A.uid, snap([att('c1'), 50]));
    // Snapshot mới nhất trong lúc chờ chọn được dùng khi bấm.
    remote.emit(A.uid, snap([att('c1'), 50], [att('c2'), 60]));
    ctl.resolveConflict('cloud');
    expect(ctl.getState()).toEqual({ kind: 'synced', user: A, online: true, pending: 0 });
    expect(store.entries().map((e) => e.attempt.id).sort()).toEqual(['c1', 'c2']);
    expect(remote.writes).toEqual([]);
  });

  it('chọn push: lượt thi khách được gắn owner và ghi lên cloud; trùng id thì giữ bản cloud', async () => {
    const { store, auth, remote, ctl } = setup();
    store.save(att('g1', 'in-progress', { answers: { 1: ['A'] } }));
    store.save(att('dup', 'in-progress', { answers: { 2: ['B'] } }));
    const cloudDup = att('dup', 'submitted', { submittedAt: 70 });
    auth.emit(A);
    remote.emit(A.uid, snap([cloudDup, 70]));
    expect(ctl.getState()).toEqual({ kind: 'conflict', user: A, count: 2 });
    ctl.resolveConflict('push');
    expect(ctl.getState()).toEqual({ kind: 'synced', user: A, online: true, pending: 1 });
    expect(remote.writes.map((w) => [w.uid, w.attempt.id])).toEqual([[A.uid, 'g1']]);
    expect(store.get('dup')).toEqual(cloudDup);
    for (const e of store.entries()) expect(e.meta.owner).toBe(A.uid);
    await flush();
    expect(ctl.getState()).toEqual({ kind: 'synced', user: A, online: true, pending: 0 });
  });

  it('resolveConflict ngoài trạng thái conflict không làm gì', () => {
    const { store, ctl } = setup();
    store.save(att('g1'));
    const state = ctl.getState();
    ctl.resolveConflict('cloud');
    expect(ctl.getState()).toBe(state);
    expect(ids(store)).toEqual(['g1']);
  });

  it('save khi đã đồng bộ thì ghi lên cloud; snapshot echo lại không gây ghi thêm', async () => {
    const { store, auth, remote, ctl } = setup();
    auth.emit(A);
    remote.emit(A.uid);
    store.save(att('n1'));
    expect(remote.writes).toHaveLength(1);
    expect(remote.writes[0]).toEqual({ uid: A.uid, attempt: att('n1'), updatedAt: store.entries()[0].meta.updatedAt });
    expect(ctl.getState()).toMatchObject({ kind: 'synced', pending: 1 });
    await flush();
    expect(ctl.getState()).toMatchObject({ kind: 'synced', pending: 0 });
    remote.emit(A.uid);
    remote.emit(A.uid);
    expect(remote.writes).toHaveLength(1);
  });

  it('snapshot cloud có bản submitted ghi đè bản in-progress trên máy dù máy mới hơn', () => {
    const { store, auth, remote } = setup();
    auth.emit(A);
    remote.emit(A.uid);
    store.save(att('x', 'in-progress', { answers: { 1: ['A'] } }));
    const writes = remote.writes.length;
    const done = att('x', 'submitted', { submittedAt: 5 });
    remote.emit(A.uid, snap([done, 5]));
    expect(store.get('x')).toEqual(done);
    expect(remote.writes).toHaveLength(writes);
  });

  it('đăng xuất giữ nguyên localStorage; đăng nhập tài khoản khác thì lượt của A bị ẩn, không bị đẩy lên, không gây conflict', async () => {
    const { store, auth, remote, ctl } = setup();
    auth.emit(A);
    remote.emit(A.uid);
    store.save(att('a1'));
    await flush();

    await ctl.signOut();
    expect(auth.signOutCount).toBe(1);
    expect(ctl.getState()).toEqual({ kind: 'signed-out' });
    expect(remote.listening(A.uid)).toBe(0);
    expect(ids(store)).toEqual(['a1']);
    expect(store.entries()[0].meta.owner).toBe(A.uid);

    auth.emit(B);
    remote.emit(B.uid);
    expect(ctl.getState()).toMatchObject({ kind: 'synced', user: B });
    expect(ids(store)).toEqual([]);
    expect(remote.writes.filter((w) => w.uid === B.uid)).toEqual([]);
    store.save(att('b1'));
    expect(remote.writes.at(-1)).toMatchObject({ uid: B.uid, attempt: { id: 'b1' } });
    await flush();

    // Đổi thẳng sang A (không qua null): phiên B bị hủy trước.
    auth.emit(A);
    expect(remote.listening(B.uid)).toBe(0);
    remote.emit(A.uid);
    expect(ctl.getState()).toMatchObject({ kind: 'synced', user: A });
    expect(ids(store)).toEqual(['a1']);
    expect(remote.writes.filter((w) => w.attempt.id === 'a1').map((w) => w.uid)).toEqual([A.uid]);
  });

  it('cùng uid báo lại thì bỏ qua, không mở listen mới', () => {
    const { auth, remote, ctl } = setup();
    auth.emit(A);
    remote.emit(A.uid);
    const state = ctl.getState();
    auth.emit(A);
    expect(ctl.getState()).toBe(state);
    expect(remote.listening(A.uid)).toBe(1);
  });

  it('signIn lỗi → state error có thông báo', async () => {
    const { auth, ctl } = setup();
    auth.emit(null);
    auth.signInError = Object.assign(new Error('popup blocked'), { code: 'auth/popup-blocked' });
    await ctl.signIn();
    const state = ctl.getState();
    expect(state.kind).toBe('error');
    expect(state.kind === 'error' && state.message).toMatch(/popup/i);

    auth.signInError = new Error('network down');
    await ctl.signIn();
    expect(auth.signInCount).toBe(2);
    expect(ctl.getState()).toEqual({ kind: 'error', message: 'Không đăng nhập được: network down' });

    await ctl.signIn();
    expect(ctl.getState()).toEqual({ kind: 'signed-out' });
    auth.emit(A);
    expect(ctl.getState()).toEqual({ kind: 'loading', user: A });
  });

  it('signIn khi đã đăng nhập thì không gọi auth', async () => {
    const { auth, ctl } = setup();
    auth.emit(A);
    await ctl.signIn();
    expect(auth.signInCount).toBe(0);
  });

  it('getState giữ nguyên tham chiếu khi không đổi; báo người nghe khi đổi; online theo onConnected', () => {
    const { auth, remote, ctl } = setup();
    const { getState, subscribe } = ctl; // dùng được khi tách khỏi object
    const listener = vi.fn();
    const unsub = subscribe(listener);
    expect(getState()).toBe(getState());
    auth.emit(A);
    remote.emit(A.uid);
    const synced = getState();
    expect(getState()).toBe(synced);
    remote.setOnline(false);
    expect(getState()).toEqual({ kind: 'synced', user: A, online: false, pending: 0 });
    expect(listener).toHaveBeenCalledTimes(3);
    unsub();
    remote.setOnline(true);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('online báo trước khi đăng nhập vẫn được giữ', () => {
    const { auth, remote, ctl } = setup();
    remote.setOnline(false);
    auth.emit(A);
    remote.emit(A.uid);
    expect(ctl.getState()).toMatchObject({ kind: 'synced', online: false });
  });

  it('write bị từ chối: giảm pending, ghi console.error, vẫn synced', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, auth, remote, ctl } = setup();
    auth.emit(A);
    remote.emit(A.uid);
    remote.writeError = new Error('PERMISSION_DENIED');
    store.save(att('n1'));
    expect(ctl.getState()).toMatchObject({ kind: 'synced', pending: 1 });
    await flush();
    expect(ctl.getState()).toEqual({ kind: 'synced', user: A, online: true, pending: 0 });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('trạng thái đầu là initializing cho tới khi auth báo lần đầu; signIn lúc đó không làm gì', async () => {
    const { auth, ctl } = setup();
    expect(ctl.getState()).toEqual({ kind: 'initializing' });
    await ctl.signIn();
    expect(auth.signInCount).toBe(0);
    auth.emit(null);
    expect(ctl.getState()).toEqual({ kind: 'signed-out' });
  });

  it('lượt đã thuộc tài khoản được sửa trước khi auth báo và trong lúc loading: không gây conflict, được đẩy lên khi đồng bộ', () => {
    const { store, auth, remote, ctl } = setup();
    const old = att('o1');
    store.put({ attempt: old, meta: { owner: A.uid, updatedAt: 50 } });
    store.put({ attempt: att('o2'), meta: { owner: A.uid, updatedAt: 50 } });
    const v2 = att('o1', 'in-progress', { answers: { 1: ['A'] } });
    store.save(v2); // tải trang, auth chưa báo
    auth.emit(A);
    const v3 = att('o2', 'submitted', { submittedAt: 60 });
    store.save(v3); // đang loading
    remote.emit(A.uid, snap([old, 50], [att('o2'), 50]));
    expect(ctl.getState()).toMatchObject({ kind: 'synced', user: A });
    expect(remote.writes.map((w) => w.attempt)).toEqual([v2, v3]);
    for (const e of store.entries()) expect(e.meta.owner).toBe(A.uid);
  });

  it('sửa lượt của tài khoản trong lúc conflict rồi chọn cloud: bản sửa không bị xóa mà được đẩy lên', () => {
    const { store, auth, remote, ctl } = setup();
    store.save(att('g1'));
    store.put({ attempt: att('o1'), meta: { owner: A.uid, updatedAt: 50 } });
    auth.emit(A);
    remote.emit(A.uid, snap([att('o1'), 50]));
    expect(ctl.getState()).toEqual({ kind: 'conflict', user: A, count: 1 });
    const edited = att('o1', 'in-progress', { answers: { 3: ['C'] } });
    store.save(edited);
    expect(remote.writes).toEqual([]);
    ctl.resolveConflict('cloud');
    expect(ctl.getState()).toMatchObject({ kind: 'synced' });
    expect(store.get('g1')).toBeUndefined();
    expect(store.get('o1')).toEqual(edited);
    expect(remote.writes.map((w) => w.attempt)).toEqual([edited]);
  });

  it('lưu lượt khách trong lúc conflict rồi chọn push: lượt mới cũng được đưa lên', () => {
    const { store, auth, remote, ctl } = setup();
    store.save(att('g1'));
    auth.emit(A);
    remote.emit(A.uid, snap());
    expect(ctl.getState()).toEqual({ kind: 'conflict', user: A, count: 1 });
    store.save(att('g2'));
    expect(store.entries().find((e) => e.attempt.id === 'g2')?.meta.owner).toBeUndefined();
    ctl.resolveConflict('push');
    expect(remote.writes.map((w) => w.attempt.id).sort()).toEqual(['g1', 'g2']);
    for (const e of store.entries()) expect(e.meta.owner).toBe(A.uid);
  });

  it('đăng xuất khi đang conflict: store không đổi, lần đăng nhập sau lại hỏi', async () => {
    const { store, auth, remote, ctl } = setup();
    store.save(att('g1'));
    auth.emit(A);
    remote.emit(A.uid, snap([att('c1'), 50]));
    expect(ctl.getState().kind).toBe('conflict');
    const before = JSON.stringify(store.entries());
    await ctl.signOut();
    expect(ctl.getState()).toEqual({ kind: 'signed-out' });
    expect(remote.listening(A.uid)).toBe(0);
    expect(JSON.stringify(store.entries())).toBe(before);
    expect(remote.writes).toEqual([]);
    auth.emit(A);
    remote.emit(A.uid, snap([att('c1'), 50]));
    expect(ctl.getState()).toEqual({ kind: 'conflict', user: A, count: 1 });
  });

  it('listener cloud báo lỗi: hủy phiên, state error có hướng dẫn; bấm đăng nhập thì mở lại phiên cho user hiện tại, không mở popup', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, auth, remote, ctl } = setup();
    auth.emit(A);
    remote.emitError(A.uid, new Error('permission_denied'));
    expect(error).toHaveBeenCalledTimes(1);
    expect(ctl.getState()).toEqual({
      kind: 'error',
      message: 'Không đọc được dữ liệu trên cloud (kiểm tra Security Rules trong docs/firebase-setup.md): permission_denied',
    });
    expect(remote.listening(A.uid)).toBe(0);
    expect(ctl.serverOffset()).toBe(0);

    await ctl.signIn();
    expect(auth.signInCount).toBe(0);
    expect(ctl.getState()).toEqual({ kind: 'loading', user: A });
    expect(remote.listening(A.uid)).toBe(1);
    remote.emit(A.uid, snap([att('c1'), 50]));
    expect(ctl.getState()).toMatchObject({ kind: 'synced', user: A });

    // Lỗi sau khi đã đồng bộ: thôi ghi lên cloud, viewer về null.
    store.save(att('n1'));
    const writes = remote.writes.length;
    remote.emitError(A.uid, new Error('boom'));
    expect(ctl.getState().kind).toBe('error');
    store.save(att('n2'));
    expect(remote.writes).toHaveLength(writes);
    expect(ids(store)).toEqual(['c1', 'n1', 'n2']);

    // Auth báo đăng xuất trong lúc lỗi → signed-out; đăng nhập lại thì mở popup.
    auth.emit(null);
    expect(ctl.getState()).toEqual({ kind: 'signed-out' });
    await ctl.signIn();
    expect(auth.signInCount).toBe(1);
  });

  it('serverOffset = 0 khi không có phiên đăng nhập (khách dùng Date.now())', async () => {
    const { auth, remote, ctl } = setup();
    expect(ctl.serverOffset()).toBe(0);
    auth.emit(A);
    expect(ctl.serverOffset()).toBe(42);
    remote.emit(A.uid);
    expect(ctl.serverOffset()).toBe(42);
    await ctl.signOut();
    expect(ctl.serverOffset()).toBe(0);
  });

  it('clockReady: initializing chưa sẵn sàng; có phiên thì chờ offset server; signed-out/error thì sẵn sàng', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { auth, remote, ctl } = setup(memoryStorage(), null);
    const listener = vi.fn();
    ctl.subscribe(listener);
    expect(ctl.clockReady()).toBe(false);
    auth.emit(A);
    expect(ctl.clockReady()).toBe(false);
    remote.emit(A.uid);
    expect(ctl.clockReady()).toBe(false);
    listener.mockClear();
    remote.setServerOffset(7);
    expect(listener).toHaveBeenCalled();
    expect(ctl.clockReady()).toBe(true);
    expect(ctl.serverOffset()).toBe(7);

    const other = setup(memoryStorage(), null);
    other.auth.emit(null);
    expect(other.ctl.clockReady()).toBe(true);
    other.auth.emit(B);
    expect(other.ctl.clockReady()).toBe(false);
    other.remote.emitError(B.uid, new Error('denied'));
    expect(other.ctl.clockReady()).toBe(true);
  });

  it('echo của SDK (snapshot cục bộ ngay khi ghi) không gây ghi thêm', async () => {
    const { store, auth, remote, ctl } = setup();
    remote.echo = true;
    auth.emit(A);
    remote.emit(A.uid);
    store.save(att('n1'));
    store.save(att('n1', 'in-progress', { answers: { 1: ['A'] } }));
    await flush();
    expect(remote.writes.map((w) => w.attempt.id)).toEqual(['n1', 'n1']);
    expect(ctl.getState()).toEqual({ kind: 'synced', user: A, online: true, pending: 0 });
    remote.emit(A.uid);
    expect(remote.writes).toHaveLength(2);
  });

  it('write bị từ chối và SDK báo lại snapshot cũ: không đẩy lại lặp vô hạn; lưu lại lượt đó thì ghi tiếp', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, auth, remote } = setup();
    remote.echo = true;
    auth.emit(A);
    remote.emit(A.uid);
    remote.writeError = new Error('PERMISSION_DENIED');
    store.save(att('n1'));
    await flush();
    await flush();
    expect(remote.writes).toHaveLength(1);
    remote.emit(A.uid);
    remote.emit(A.uid);
    expect(remote.writes).toHaveLength(1);
    store.save(att('n1', 'in-progress', { answers: { 1: ['A'] } }));
    expect(remote.writes).toHaveLength(2);
    await flush();
    expect(remote.data.get(A.uid)?.get('n1')?.attempt.answers).toEqual({ 1: ['A'] });
  });
});
