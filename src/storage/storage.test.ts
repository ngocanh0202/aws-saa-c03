import type { Attempt } from '../engine/attempt';
import { OWNERS_KEY, STORAGE_KEY, createStore } from './storage';

function attempt(id: string): Attempt {
  return { id, setId: 1, mode: 'real', seed: 1, esl: false, startedAt: 0, questions: [], answers: {}, flagged: [], guideOpened: [], status: 'in-progress' };
}

function fakeStorage(initial: Record<string, string> = {}, failWrites = false): Storage {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => {
      if (failWrites) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
  };
}

describe('createStore', () => {
  it('lưu rồi đọc lại qua một store mới (giống tải lại trang)', () => {
    const storage = fakeStorage();
    createStore(storage).save(attempt('a'));
    const reloaded = createStore(storage);
    expect(reloaded.get('a')?.id).toBe('a');
    expect(reloaded.list()).toHaveLength(1);
  });

  it('JSON hỏng thì coi như rỗng, không ném lỗi', () => {
    const store = createStore(fakeStorage({ [STORAGE_KEY]: '{not json' }));
    expect(store.list()).toEqual([]);
  });

  it('bỏ qua bản ghi không đúng cấu trúc, giữ bản ghi hợp lệ', () => {
    const raw = JSON.stringify({ a: attempt('a'), b: { id: 5 }, c: null });
    expect(createStore(fakeStorage({ [STORAGE_KEY]: raw })).list().map((x) => x.id)).toEqual(['a']);
  });

  it('ghi thất bại: trả về false, available = false, vẫn giữ trong bộ nhớ', () => {
    const store = createStore(fakeStorage({}, true));
    expect(store.save(attempt('a'))).toBe(false);
    expect(store.available).toBe(false);
    expect(store.get('a')?.id).toBe('a');
  });

  it('không có storage: chạy bằng bộ nhớ tạm', () => {
    const store = createStore(null);
    expect(store.available).toBe(false);
    store.save(attempt('x'));
    expect(store.get('x')?.id).toBe('x');
  });

  it('hai tab (hai store) dùng chung storage: lưu ở tab này không xóa mất lượt thi tab kia lưu', () => {
    const storage = fakeStorage();
    const tabA = createStore(storage);
    const tabB = createStore(storage);
    tabA.save(attempt('a'));
    tabB.save(attempt('b'));
    expect(tabA.list().map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(tabB.list().map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(tabA.get('b')?.id).toBe('b');
  });

  it('bỏ qua bản ghi thiếu guideOpened hoặc có status/mode không hợp lệ', () => {
    const bad1 = { id: 'bad1', setId: 1, mode: 'real', questions: [], answers: {}, flagged: [], status: 'submitted' };
    const bad2 = { ...attempt('bad2'), status: 'weird' };
    const bad3 = { ...attempt('bad3'), mode: 'other' };
    const bad4 = { ...attempt('bad4'), flagged: 'nope' };
    const raw = JSON.stringify({ good: attempt('good'), bad1, bad2, bad3, bad4 });
    expect(
      createStore(fakeStorage({ [STORAGE_KEY]: raw }))
        .list()
        .map((x) => x.id),
    ).toEqual(['good']);
  });

  it('save gắn owner theo viewer và updatedAt = now()', () => {
    const store = createStore(fakeStorage(), { now: () => 500 });
    store.setViewer('u1');
    store.save(attempt('a'));
    expect(store.entries()[0].meta).toEqual({ owner: 'u1', updatedAt: 500 });
    store.setViewer(null);
    store.save(attempt('b'));
    expect(store.entries().find((e) => e.attempt.id === 'b')?.meta.owner).toBeUndefined();
  });

  it('save khi viewer = null vẫn giữ owner sẵn có của lượt thi (không biến thành lượt khách)', () => {
    const store = createStore(fakeStorage(), { now: () => 900 });
    store.put({ attempt: attempt('a'), meta: { owner: 'u1', updatedAt: 1 } });
    store.save({ ...attempt('a'), answers: { 1: ['A'] } });
    expect(store.entries()[0].meta).toEqual({ owner: 'u1', updatedAt: 900 });
    const seen = vi.fn();
    store.onSave(seen);
    store.save(attempt('a'));
    expect(seen.mock.calls[0][0].meta).toEqual({ owner: 'u1', updatedAt: 900 });
    // viewer đặt rồi thì viewer được dùng.
    store.setViewer('u2');
    store.save(attempt('b'));
    expect(store.entries().find((e) => e.attempt.id === 'b')?.meta.owner).toBe('u2');
  });

  it('hai tab: tab B đã tải bản cũ vẫn đọc được bản mới tab A vừa lưu, và lưu id khác không ghi đè bản đó', () => {
    const storage = fakeStorage();
    const seed = createStore(storage, { now: () => 1 });
    seed.setViewer('u1');
    seed.save(attempt('x'));
    const tabA = createStore(storage, { now: () => 2 });
    const tabB = createStore(storage, { now: () => 3 });
    expect(tabB.get('x')?.answers).toEqual({});

    const v2 = { ...attempt('x'), answers: { 1: ['B'] } };
    tabA.setViewer('u1');
    tabA.save(v2);
    expect(tabB.get('x')).toEqual(v2);
    expect(tabB.entries().find((e) => e.attempt.id === 'x')?.meta).toEqual({ owner: 'u1', updatedAt: 2 });

    tabB.save(attempt('y'));
    for (const s of [tabA, tabB, createStore(storage)]) {
      expect(s.get('x')).toEqual(v2);
      expect(s.entries().find((e) => e.attempt.id === 'x')?.meta).toEqual({ owner: 'u1', updatedAt: 2 });
      expect(s.get('y')?.id).toBe('y');
    }
  });

  it('ẩn lượt thi của tài khoản khác khi đang đăng nhập', () => {
    const store = createStore(fakeStorage());
    store.put({ attempt: attempt('a'), meta: { owner: 'A', updatedAt: 1 } });
    store.put({ attempt: attempt('b'), meta: { owner: 'B', updatedAt: 1 } });
    store.put({ attempt: attempt('g'), meta: { updatedAt: 1 } });
    store.setViewer('B');
    expect(store.list().map((x) => x.id).sort()).toEqual(['b', 'g']);
    expect(store.get('a')).toBeUndefined();
    store.setViewer(null);
    expect(store.list()).toHaveLength(3);
  });

  it('metadata sống qua tải lại trang', () => {
    const storage = fakeStorage();
    const store = createStore(storage, { now: () => 7 });
    store.setViewer('u1');
    store.save(attempt('a'));
    expect(createStore(storage).entries()[0].meta.owner).toBe('u1');
  });

  it('lượt thi cũ không có metadata dùng submittedAt/startedAt', () => {
    const old = { ...attempt('old'), startedAt: 10 };
    const done = { ...attempt('done'), startedAt: 10, submittedAt: 20 };
    const store = createStore(fakeStorage({ [STORAGE_KEY]: JSON.stringify({ old, done }) }));
    const metas = Object.fromEntries(store.entries().map((e) => [e.attempt.id, e.meta]));
    expect(metas).toEqual({ old: { updatedAt: 10 }, done: { updatedAt: 20 } });
  });

  it('subscribe được gọi khi save, put, remove, setViewer; version tăng; hủy đăng ký thì thôi gọi', () => {
    const store = createStore(fakeStorage());
    const fn = vi.fn();
    const off = store.subscribe(fn);
    const v0 = store.version();
    store.save(attempt('a'));
    store.put({ attempt: attempt('b'), meta: { updatedAt: 1 } });
    store.remove(['a']);
    store.setViewer('u');
    expect(fn).toHaveBeenCalledTimes(4);
    expect(store.version()).toBe(v0 + 4);
    expect(store.version()).toBe(store.version());
    off();
    store.setViewer(null);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('onSave chỉ chạy khi save, không chạy khi put', () => {
    const store = createStore(fakeStorage(), { now: () => 5 });
    const fn = vi.fn();
    store.onSave(fn);
    store.put({ attempt: attempt('p'), meta: { updatedAt: 1 } });
    expect(fn).not.toHaveBeenCalled();
    store.save(attempt('s'));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toEqual({ attempt: attempt('s'), meta: { updatedAt: 5 } });
  });

  it('remove xóa cả lượt thi lẫn metadata khỏi storage', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    store.save(attempt('a'));
    store.save(attempt('b'));
    store.remove(['a']);
    expect(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}'))).toEqual(['b']);
    expect(Object.keys(JSON.parse(storage.getItem(OWNERS_KEY) ?? '{}'))).toEqual(['b']);
    expect(createStore(storage).get('a')).toBeUndefined();
  });

  it('watch: sự kiện storage của tab khác làm subscribe chạy', () => {
    const store = createStore(fakeStorage(), { watch: true });
    const fn = vi.fn();
    store.subscribe(fn);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    expect(fn).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
