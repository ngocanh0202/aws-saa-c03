import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../test/fixtures';
import { fakeAuth, fakeRemoteNotes } from '../test/fake-sync';
import { createFreeNote, removeItem, type QuestionNotes } from './model';
import { createNotesStore } from './store';
import { startNotesSync } from './sync';

const hl = (id: string) => ({ id, part: 'stem' as const, start: 0, end: 3, text: 'abc', note: '', updatedAt: 1 });
const n = (qid: number, updatedAt: number, ids: string[] = ['h']): QuestionNotes => ({ qid, updatedAt, highlights: ids.map(hl) });
const user = (uid: string) => ({ uid, name: uid });
const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const notes = createNotesStore(null);
  const auth = fakeAuth();
  const remote = fakeRemoteNotes();
  const stop = startNotesSync({ notes, auth, remote });
  return { notes, auth, remote, stop };
}

describe('startNotesSync', () => {
  it('đăng nhập đặt owner, nhận bản cloud mới hơn và đẩy bản máy mới hơn', async () => {
    const { notes, auth, remote } = setup();
    notes.applyRemote('A', n(1, 10));
    notes.applyRemote('A', n(2, 50));
    remote.data.set('A', new Map([[1, n(1, 20, ['x'])], [2, n(2, 5)], [3, n(3, 7)]]));
    auth.emit(user('A'));
    expect(notes.owner()).toBe('A');
    remote.emit('A');
    await tick();
    expect(notes.get(1)?.updatedAt).toBe(20);
    expect(notes.get(3)?.updatedAt).toBe(7);
    expect(remote.writes.map((w) => w.notes.qid)).toEqual([2]);
    expect(remote.writes[0].uid).toBe('A');
  });

  it('bản chỉ có ở máy thì được đẩy lên', async () => {
    const { notes, auth, remote } = setup();
    notes.applyRemote('A', n(9, 3));
    auth.emit(user('A'));
    remote.emit('A', new Map());
    await tick();
    expect(remote.writes.map((w) => w.notes.qid)).toEqual([9]);
  });

  it('khách có ghi chú khi đăng nhập thì gộp, đẩy lên, ngăn khách rỗng', async () => {
    const { notes, auth, remote } = setup();
    notes.save(n(4, 30));
    auth.emit(user('A'));
    expect(remote.writes).toEqual([]);
    remote.emit('A', new Map());
    await tick();
    expect(remote.writes.map((w) => w.notes.qid)).toEqual([4]);
    expect(notes.all('A').map((x) => x.qid)).toEqual([4]);
    auth.emit(null);
    expect(notes.owner()).toBeNull();
    expect(notes.list()).toEqual([]);
  });

  it('ghi chú khách cũ hơn bản cloud thì cloud thắng, không ghi đè', async () => {
    const { notes, auth, remote } = setup();
    notes.save(n(4, 30));
    auth.emit(user('A'));
    remote.emit('A', new Map([[4, n(4, 100, ['cloud'])]]));
    await tick();
    expect(remote.writes).toEqual([]);
    expect(notes.get(4)).toEqual(n(4, 100, ['cloud']));
    expect(notes.all('A')).toEqual([n(4, 100, ['cloud'])]);
  });

  it('đang đăng nhập, save() thì write với đúng uid', async () => {
    const { notes, auth, remote } = setup();
    auth.emit(user('A'));
    notes.save(n(5, 40));
    await tick();
    expect(remote.writes).toEqual([{ uid: 'A', notes: n(5, 40) }]);
  });

  it('đăng xuất thì owner null, không write nữa và thôi nghe', async () => {
    const { notes, auth, remote } = setup();
    auth.emit(user('A'));
    auth.emit(null);
    expect(notes.owner()).toBeNull();
    expect(remote.listening('A')).toBe(0);
    notes.save(n(6, 1));
    await tick();
    expect(remote.writes).toEqual([]);
  });

  it('cloud gửi bản rỗng mới hơn thì câu đó biến khỏi list()', async () => {
    const { notes, auth, remote } = setup();
    notes.applyRemote('A', n(7, 10));
    auth.emit(user('A'));
    expect(notes.list().map((x) => x.qid)).toEqual([7]);
    remote.emit('A', new Map([[7, n(7, 20, [])]]));
    await tick();
    expect(notes.list()).toEqual([]);
    expect(remote.writes).toEqual([]);
  });

  it('write lỗi không làm hỏng store, lần save sau vẫn đẩy được', async () => {
    const { notes, auth, remote } = setup();
    auth.emit(user('A'));
    remote.writeError = new Error('offline');
    notes.save(n(8, 1));
    await tick();
    expect(notes.get(8)?.updatedAt).toBe(1);
    notes.save(n(8, 2));
    await tick();
    expect(remote.data.get('A')?.get(8)?.updatedAt).toBe(2);
  });

  it('stop thôi nghe auth, cloud và thay đổi cục bộ', async () => {
    const { notes, auth, remote, stop } = setup();
    auth.emit(user('A'));
    stop();
    expect(remote.listening('A')).toBe(0);
    notes.save(n(1, 1));
    await tick();
    expect(remote.writes).toEqual([]);
  });
});

describe('startNotesSync — xóa hẳn bản ghi rỗng', () => {
  const empty = (qid: number, updatedAt: number): QuestionNotes => ({ qid, updatedAt, highlights: [], items: [] });

  it('xóa ghi chú cuối của ghi chú chung: xóa ở máy và xóa node trên cloud', async () => {
    const { notes, auth, remote } = setup();
    auth.emit(user('A'));
    remote.emit('A', new Map());
    const free = createFreeNote(-7, { title: 'T', content: '' }, 'i1', 10);
    notes.save(free);
    await tick();
    expect(remote.data.get('A')?.has(-7)).toBe(true);
    notes.save(removeItem(free, 'i1', 11));
    await tick();
    expect(notes.get(-7)).toBeUndefined();
    expect(notes.all('A').map((x) => x.qid)).not.toContain(-7);
    expect(remote.removes).toEqual([{ uid: 'A', qid: -7 }]);
    expect(remote.data.get('A')?.has(-7)).toBe(false);
  });

  it('máy khác đã xóa (bản từng có trên cloud nay không còn): xóa ở máy, không đẩy lại', async () => {
    const { notes, auth, remote } = setup();
    remote.data.set('A', new Map([[-7, createFreeNote(-7, { title: 'T', content: '' }, 'i1', 10)]]));
    auth.emit(user('A'));
    remote.emit('A');
    await tick();
    expect(notes.get(-7)).toBeDefined();
    remote.emit('A', new Map());
    await tick();
    expect(notes.get(-7)).toBeUndefined();
    expect(remote.writes).toEqual([]);
  });

  it('nhớ những bản đã thấy trên cloud qua lần tải lại trang', async () => {
    const storage = memoryStorage();
    const first = createNotesStore(storage);
    const auth1 = fakeAuth();
    const remote1 = fakeRemoteNotes();
    remote1.data.set('A', new Map([[5, n(5, 10)]]));
    const stop = startNotesSync({ notes: first, auth: auth1, remote: remote1 });
    auth1.emit(user('A'));
    remote1.emit('A');
    await tick();
    stop();
    const second = createNotesStore(storage);
    const auth2 = fakeAuth();
    const remote2 = fakeRemoteNotes();
    startNotesSync({ notes: second, auth: auth2, remote: remote2 });
    auth2.emit(user('A'));
    remote2.emit('A', new Map());
    await tick();
    expect(second.get(5)).toBeUndefined();
    expect(remote2.writes).toEqual([]);
  });

  it('bản rỗng cũ còn trên cloud: dọn node, không lưu ở máy', async () => {
    const { notes, auth, remote } = setup();
    remote.data.set('A', new Map([[-9, empty(-9, 20)], [1, n(1, 5)]]));
    auth.emit(user('A'));
    remote.emit('A');
    await tick();
    expect(remote.removes).toEqual([{ uid: 'A', qid: -9 }]);
    expect(notes.all('A').map((x) => x.qid)).toEqual([1]);
  });

  it('bản rỗng cũ trên cloud nhưng máy có bản mới hơn còn nội dung: đẩy bản máy lên', async () => {
    const { notes, auth, remote } = setup();
    notes.applyRemote('A', n(3, 30));
    remote.data.set('A', new Map([[3, empty(3, 20)]]));
    auth.emit(user('A'));
    remote.emit('A');
    await tick();
    expect(remote.removes).toEqual([]);
    expect(remote.writes.map((w) => w.notes.qid)).toEqual([3]);
  });
});
