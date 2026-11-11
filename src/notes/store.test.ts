import { describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/fixtures';
import type { QuestionNotes } from './model';
import { NOTES_KEY_PREFIX, createNotesStore } from './store';

function notes(qid: number, note: string, updatedAt = 100, withHighlight = true): QuestionNotes {
  return {
    qid,
    updatedAt,
    highlights: withHighlight ? [{ id: `h${qid}`, part: 'stem', start: 0, end: 3, text: 'abc', note, updatedAt }] : [],
  };
}

describe('NotesStore', () => {
  it('tách ngăn: A không thấy ghi chú của B', () => {
    const s = createNotesStore(memoryStorage());
    s.setOwner('A'); s.save(notes(5, 'của A'));
    s.setOwner('B'); expect(s.get(5)).toBeUndefined();
    s.setOwner('A'); expect(s.get(5)?.highlights[0].note).toBe('của A');
  });
  it('adoptGuest gộp ngăn khách vào tài khoản rồi làm rỗng ngăn khách', () => {
    const s = createNotesStore(memoryStorage());
    s.setOwner(null); s.save(notes(5, 'khách', 200));
    s.applyRemote('A', notes(5, 'cloud', 100));
    const push = s.adoptGuest('A');
    expect(push.map((n) => n.qid)).toEqual([5]);
    s.setOwner('A'); expect(s.get(5)?.highlights[0].note).toBe('khách');
    s.setOwner(null); expect(s.list()).toEqual([]);
  });
  it('adoptGuest không đẩy bản cloud mới hơn', () => {
    const s = createNotesStore(memoryStorage());
    s.save(notes(5, 'khách', 100));
    s.applyRemote('A', notes(5, 'cloud', 200));
    expect(s.adoptGuest('A')).toEqual([]);
    s.setOwner('A'); expect(s.get(5)?.highlights[0].note).toBe('cloud');
  });
  it('list bỏ câu không còn đoạn tô, sắp giảm dần; all thì giữ', () => {
    const s = createNotesStore(memoryStorage());
    s.setOwner('A');
    s.save(notes(1, 'a', 10)); s.save(notes(2, 'b', 30)); s.save(notes(3, '', 20, false));
    expect(s.list().map((n) => n.qid)).toEqual([2, 1]);
    expect(s.all('A').map((n) => n.qid).sort()).toEqual([1, 2, 3]);
  });
  it('storage null (bị chặn) vẫn chạy trong bộ nhớ', () => {
    const s = createNotesStore(null);
    s.save(notes(5, 'x'));
    expect(s.get(5)?.qid).toBe(5);
  });
  it('storage ném lỗi vẫn chạy', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } } as unknown as Storage;
    const s = createNotesStore(bad);
    s.save(notes(5, 'x'));
    expect(s.get(5)?.qid).toBe(5);
  });
  it('dữ liệu hỏng trong localStorage bị bỏ qua', () => {
    const st = memoryStorage();
    st.setItem(NOTES_KEY_PREFIX + 'guest', '{không phải json');
    expect(createNotesStore(st).list()).toEqual([]);
    st.setItem(NOTES_KEY_PREFIX + 'guest', JSON.stringify({ 5: { qid: 5 }, 6: notes(6, 'ok') }));
    expect(createNotesStore(st).list().map((n) => n.qid)).toEqual([6]);
  });
  it('lưu bền: store mới đọc lại được', () => {
    const st = memoryStorage();
    createNotesStore(st).save(notes(5, 'x'));
    expect(createNotesStore(st).get(5)?.highlights[0].note).toBe('x');
  });
  it('onLocalChange chỉ báo khi save có owner', () => {
    const s = createNotesStore(memoryStorage());
    const cb = vi.fn();
    s.onLocalChange(cb);
    s.save(notes(1, 'khách'));
    s.applyRemote('A', notes(2, 'cloud'));
    expect(cb).not.toHaveBeenCalled();
    s.setOwner('A');
    s.save(notes(3, 'x'));
    expect(cb).toHaveBeenCalledWith('A', notes(3, 'x'));
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it('subscribe báo khi save, applyRemote vào ngăn hiện tại, adoptGuest, setOwner', () => {
    const s = createNotesStore(memoryStorage());
    const l = vi.fn();
    const off = s.subscribe(l);
    s.setOwner('A'); expect(l).toHaveBeenCalledTimes(1);
    s.save(notes(1, 'x')); expect(l).toHaveBeenCalledTimes(2);
    s.applyRemote('A', notes(2, 'x')); expect(l).toHaveBeenCalledTimes(3);
    s.applyRemote('B', notes(2, 'x')); expect(l).toHaveBeenCalledTimes(3);
    s.adoptGuest('A'); expect(l).toHaveBeenCalledTimes(4);
    off(); s.save(notes(9, 'x')); expect(l).toHaveBeenCalledTimes(4);
  });
});
