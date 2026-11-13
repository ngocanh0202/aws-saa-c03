import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { submitAttempt } from '../engine/actions';
import { createAttempt, type Mode } from '../engine/attempt';
import { createStore } from '../storage/storage';
import { createSyncController } from '../sync/controller';
import { fakeAi, fakeChats } from '../test/fake-ai';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';
import { ITEM_CONTENT_MAX } from './model';

function setup(mode: Mode, submitted = false) {
  const deps = makeDeps();
  let attempt = createAttempt({ id: 'e1', setId: 1, mode, esl: true, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
  if (submitted) attempt = submitAttempt(attempt, deps.now());
  deps.store.save(attempt);
  const qid = attempt.questions[0].qid;
  return { deps, attempt, qid, canon: deps.bank.canonical(qid) };
}

function fill(title: string, content: string) {
  const dialog = screen.getByRole('dialog', { name: /Ghi chú/ });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tiêu đề' }), { target: { value: title } });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nội dung' }), { target: { value: content } });
  return dialog;
}

afterEach(() => document.getSelection()?.removeAllRanges());

describe('Tự ghi chú — Thi thử', () => {
  it('nút "Ghi chú" mở khung của câu; lưu thành ghi chú tự ghi, khung vẫn mở', () => {
    const { deps, canon } = setup('practice');
    renderApp('/exam/e1', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Ghi chú' }));
    const dialog = fill('Nhớ Multi-AZ', 'Failover tự động');
    expect(dialog).toHaveAccessibleName('Ghi chú · Câu 1');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(screen.getByRole('dialog', { name: 'Ghi chú · Câu 1' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Nhớ Multi-AZ' })).toBeInTheDocument();
    expect(deps.notes.get(canon)!.items).toEqual([
      expect.objectContaining({ kind: 'manual', title: 'Nhớ Multi-AZ', content: 'Failover tự động' }),
    ]);
  });

  it('tiêu đề rỗng thì không lưu được; Đóng thì không lưu', () => {
    const { deps, canon } = setup('practice');
    renderApp('/exam/e1', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Ghi chú' }));
    const dialog = fill('   ', 'x');
    expect(within(dialog).getByRole('button', { name: 'Lưu' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog', { name: /Ghi chú/ })).toBeNull();
    expect(deps.notes.get(canon)).toBeUndefined();
  });

  it('quá dung lượng của câu: báo lỗi, giữ form', () => {
    const { deps, canon } = setup('practice');
    for (let i = 0; i < 9; i++) {
      const cur = deps.notes.get(canon) ?? { qid: canon, highlights: [], updatedAt: 1 };
      deps.notes.save({ ...cur, items: [...(cur.items ?? []), { id: `m${i}`, kind: 'manual', title: 'T', content: 'x'.repeat(ITEM_CONTENT_MAX), createdAt: 1, updatedAt: 1 }] });
    }
    renderApp('/exam/e1', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Ghi chú' }));
    const dialog = fill('Thêm', 'y'.repeat(5000));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Ghi chú của câu này đã quá dài, hãy xóa bớt.');
    expect(deps.notes.get(canon)!.items).toHaveLength(9);
  });
});

describe('Nút Ghi chú nổi ở Thi thử', () => {
  it('không còn trong thanh trên; nằm trong dock trước nút Hỏi Gemini', () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const remote = fakeRemote();
    const sync = createSyncController({ store, auth, remote });
    const deps = { ...makeDeps({ store, sync }), ai: fakeAi(), chats: fakeChats() };
    const attempt = createAttempt({ id: 'e1', setId: 1, mode: 'practice', esl: false, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
    store.save(attempt);
    const { container } = renderApp('/exam/e1', deps);
    act(() => auth.emit({ uid: 'u1', name: 'An' }));
    act(() => remote.emit('u1', new Map([[attempt.id, { attempt, updatedAt: 1 }]])));
    expect(within(container.querySelector('header.exam__bar') as HTMLElement).queryByRole('button', { name: 'Ghi chú' })).toBeNull();
    const dock = container.querySelector('.exam-dock') as HTMLElement;
    const names = within(dock).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
    expect(names).toEqual(['Ghi chú', 'Hỏi Gemini']);
  });

  it('không có AI: dock chỉ có nút Ghi chú; bấm thì mở khung của câu', () => {
    const { deps } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    const dock = container.querySelector('.exam-dock') as HTMLElement;
    expect(within(dock).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(within(dock).getByRole('button', { name: 'Ghi chú' }));
    // Khung không nằm trong dock (stacking context riêng sẽ đè nó dưới nút danh sách câu).
    expect(screen.getByRole('dialog', { name: 'Ghi chú · Câu 1' }).closest('.exam-dock')).toBeNull();
  });
});

describe('Khung ghi chú khi làm bài', () => {
  it('đổi câu khi khung đang mở: khung vẫn mở và theo câu mới', () => {
    const { deps } = setup('practice');
    renderApp('/exam/e1', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Ghi chú' }));
    expect(screen.getByRole('dialog', { name: 'Ghi chú · Câu 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Câu sau' }));
    expect(screen.getByRole('dialog', { name: 'Ghi chú · Câu 2' })).toBeInTheDocument();
  });

  it('mỗi lúc một khung: mở chat thì khung ghi chú đóng, mở ghi chú thì chat đóng', () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const remote = fakeRemote();
    const sync = createSyncController({ store, auth, remote });
    const deps = { ...makeDeps({ store, sync }), ai: fakeAi(), chats: fakeChats() };
    const attempt = createAttempt({ id: 'e1', setId: 1, mode: 'practice', esl: false, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
    store.save(attempt);
    renderApp('/exam/e1', deps);
    act(() => auth.emit({ uid: 'u1', name: 'An' }));
    act(() => remote.emit('u1', new Map([[attempt.id, { attempt, updatedAt: 1 }]])));
    fireEvent.click(screen.getByRole('button', { name: 'Ghi chú' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi Gemini' }));
    expect(screen.queryByRole('dialog', { name: /^Ghi chú/ })).toBeNull();
    expect(screen.getByRole('dialog', { name: /Hỏi Gemini/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ghi chú' }));
    expect(screen.queryByRole('dialog', { name: /Hỏi Gemini/ })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Ghi chú · Câu 1' })).toBeInTheDocument();
  });
});

describe('Tự ghi chú — Thi thật', () => {
  it('đang làm: không có nút Ghi chú', () => {
    const { deps } = setup('real');
    renderApp('/exam/e1', deps);
    expect(screen.queryByRole('button', { name: 'Ghi chú' })).toBeNull();
  });

  it('đã nộp: trang xem lại có nút Ghi chú ở mỗi câu và tô được đề', () => {
    const { deps, attempt, canon } = setup('real', true);
    const { container } = renderApp(`/result/${attempt.id}`, deps);
    const buttons = screen.getAllByRole('button', { name: 'Ghi chú' });
    expect(buttons).toHaveLength(65);
    fireEvent.click(buttons[0]);
    const dialog = fill('Sau khi nộp', 'ôn lại');
    expect(dialog).toHaveAccessibleName('Ghi chú · Câu 1');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(deps.notes.get(canon)!.items![0]).toMatchObject({ kind: 'manual', title: 'Sau khi nộp' });
    // Tô đề ở trang xem lại.
    const stem = container.querySelector('.qcard [data-part="stem"]')!;
    const text = document.createTreeWalker(stem, NodeFilter.SHOW_TEXT).nextNode()!;
    const r = document.createRange();
    r.setStart(text, 0);
    r.setEnd(text, 4);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(r);
    fireEvent(document, new Event('selectionchange'));
    fireEvent.click(screen.getByRole('button', { name: 'Tô' }));
    expect(deps.notes.get(canon)!.highlights).toHaveLength(1);
  });
});

describe('Giới hạn dung lượng khi tô đề', () => {
  it('câu đã đầy: bôi chọn → Tô thì không lưu, báo quá dài', () => {
    const { deps, canon } = setup('practice');
    const items = Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, kind: 'manual' as const, title: 'T', content: 'x'.repeat(ITEM_CONTENT_MAX - 10), createdAt: 1, updatedAt: 1 }));
    deps.notes.save({ qid: canon, highlights: [], items, updatedAt: 1 });
    const { container } = renderApp('/exam/e1', deps);
    const stem = container.querySelector('.qcard [data-part="stem"]')!;
    const text = document.createTreeWalker(stem, NodeFilter.SHOW_TEXT).nextNode()!;
    const r = document.createRange();
    r.setStart(text, 0);
    r.setEnd(text, 4);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(r);
    fireEvent(document, new Event('selectionchange'));
    // Thêm một ghi chú nữa cho đầy hẳn rồi mới tô.
    deps.notes.save({ ...deps.notes.get(canon)!, items: [...items, { ...items[0], id: 'm9', content: 'y'.repeat(ITEM_CONTENT_MAX - 2000) }] });
    fireEvent.click(screen.getByRole('button', { name: 'Tô' }));
    expect(deps.notes.get(canon)!.highlights).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent('Ghi chú của câu này đã quá dài, hãy xóa bớt.');
  });
});
