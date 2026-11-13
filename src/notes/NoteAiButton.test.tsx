import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { submitAttempt } from '../engine/actions';
import { createAttempt } from '../engine/attempt';
import { createStore } from '../storage/storage';
import { createSyncController } from '../sync/controller';
import type { SyncUser } from '../sync/types';
import { fakeAi, fakeChats } from '../test/fake-ai';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';
import { resetNoteErrors } from './note-ai';

const USER: SyncUser = { uid: 'u1', name: 'An Nguyen' };
const AI_BTN = 'AI soạn ghi chú';

function setup({ signedIn = true }: { signedIn?: boolean } = {}) {
  const store = createStore(memoryStorage(), { now: () => 500 });
  const auth = fakeAuth();
  const remote = fakeRemote();
  const sync = createSyncController({ store, auth, remote });
  const ai = fakeAi();
  const deps = { ...makeDeps({ store, sync }), ai, chats: fakeChats() };
  const attempt = createAttempt({ id: 'e1', setId: 1, mode: 'practice', esl: false, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
  store.save(attempt);
  const { container } = renderApp('/exam/e1', deps);
  act(() => auth.emit(signedIn ? USER : null));
  if (signedIn) act(() => remote.emit(USER.uid, new Map([[attempt.id, { attempt, updatedAt: 1 }]])));
  const canon = (i: number) => deps.bank.canonical(attempt.questions[i].qid);
  return { deps, ai, container, attempt, canon };
}

function firstText(el: Node): Text {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const n = w.nextNode();
  if (!n) throw new Error('no text');
  return n as Text;
}

function select(node: Node, from: number, to: number) {
  const r = document.createRange();
  r.setStart(node, from);
  r.setEnd(node, to);
  const s = document.getSelection()!;
  s.removeAllRanges();
  s.addRange(r);
  fireEvent(document, new Event('selectionchange'));
}

const stemEl = (c: HTMLElement) => c.querySelector('.qcard [data-part="stem"]') as HTMLElement;

/** Tô "Stem" của câu đang hiện và mở popup ghi chú. */
function highlightAndOpen(c: HTMLElement) {
  select(firstText(stemEl(c)), 0, 4);
  fireEvent.click(screen.getByRole('button', { name: 'Tô và ghi chú' }));
  return screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' });
}

const tick = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  resetNoteErrors();
});

describe('AI soạn ghi chú', () => {
  it('chưa đăng nhập → không có nút AI soạn', () => {
    const { container } = setup({ signedIn: false });
    const pop = highlightAndOpen(container);
    expect(within(pop).queryByRole('button', { name: AI_BTN })).toBeNull();
  });

  it('chạy nền: câu khác bị khóa ô ghi chú, vẫn tô/xóa được; xong thì toast, "Đến câu 1" mở đúng popup có chữ AI', async () => {
    const { deps, ai, container, canon } = setup();
    ai.reply = ['Ghi chú của AI'];
    ai.hold = true;
    const pop = highlightAndOpen(container);
    fireEvent.change(within(pop).getByRole('textbox', { name: 'Ghi chú' }), { target: { value: 'tự gõ' } });
    fireEvent.click(within(pop).getByRole('button', { name: AI_BTN }));
    // Chữ đang gõ được lưu trước để chữ AI nối vào sau.
    expect(deps.notes.get(canon(0))!.highlights[0].note).toBe('tự gõ');
    expect(container.querySelector('mark.hl')).toHaveClass('hl--drafting');
    expect(within(pop).getByRole('textbox', { name: 'Ghi chú' })).toBeDisabled();
    expect(within(pop).getByRole('button', { name: AI_BTN })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Câu sau' }));
    const pop2 = highlightAndOpen(container);
    expect(within(pop2).getByRole('textbox', { name: 'Ghi chú' })).toBeDisabled();
    expect(within(pop2).getByRole('button', { name: AI_BTN })).toBeDisabled();
    expect(within(pop2).getByText('AI đang soạn ghi chú ở Câu 1')).toBeInTheDocument();
    expect(container.querySelector('mark.hl')).not.toHaveClass('hl--drafting');
    // Xóa đoạn tô vẫn được.
    fireEvent.click(within(pop2).getByRole('button', { name: 'Xóa đoạn tô' }));
    expect(deps.notes.get(canon(1))).toBeUndefined();
    // Tô đoạn mới vẫn được.
    select(firstText(stemEl(container)), 0, 4);
    fireEvent.click(screen.getByRole('button', { name: 'Tô' }));
    expect(deps.notes.get(canon(1))!.highlights).toHaveLength(1);

    await tick();
    await act(async () => ai.release());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('AI đã soạn ghi chú ở Câu 1'));
    expect(deps.notes.get(canon(0))!.highlights[0].note).toBe('tự gõ\n\nGhi chú của AI');

    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Đến câu 1' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toHaveValue('tự gõ\n\nGhi chú của AI'));
    expect(stemEl(container).textContent).toContain(`Stem ${deps.store.get('e1')!.questions[0].qid}`);
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toBeEnabled();
    expect(container.querySelector('mark.hl')).not.toHaveClass('hl--drafting');
  });

  it('"Đến câu" từ câu khác: popup đặt theo mark của câu đích (không rơi về góc trên bên trái)', async () => {
    const scrolled: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    try {
      const { ai, container } = setup();
      ai.reply = ['Chữ AI'];
      ai.hold = true;
      const pop = highlightAndOpen(container);
      const id = container.querySelector<HTMLElement>('mark.hl')!.dataset.hl;
      fireEvent.click(within(pop).getByRole('button', { name: AI_BTN }));
      fireEvent.click(screen.getByRole('button', { name: 'Câu sau' }));
      await tick();
      await act(async () => ai.release());
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('AI đã soạn ghi chú ở Câu 1'));

      fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Đến câu 1' }));
      await waitFor(() => expect(screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' })).toBeInTheDocument());
      // Lúc nhận yêu cầu mở, Highlighter phải thấy mark của đoạn đó trong đề câu 1 (đang gắn vào trang).
      const target = scrolled.find((el) => el instanceof HTMLElement && el.dataset.hl === id);
      expect(target).toBeDefined();
      expect(target!.isConnected).toBe(true);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('popup của đúng đoạn đang mở lúc xong → không toast, ô ghi chú hiện chữ mới', async () => {
    const { ai, container } = setup();
    ai.reply = ['Chữ AI'];
    ai.hold = true;
    const pop = highlightAndOpen(container);
    fireEvent.click(within(pop).getByRole('button', { name: AI_BTN }));
    await tick();
    await act(async () => ai.release());
    await waitFor(() => expect(within(pop).getByRole('textbox', { name: 'Ghi chú' })).toHaveValue('Chữ AI'));
    expect(within(pop).getByRole('textbox', { name: 'Ghi chú' })).toBeEnabled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('chat AI đang chạy → ô ghi chú khóa với dòng "AI đang trả lời ở …"', () => {
    const { deps, container } = setup();
    let release!: () => void;
    act(() => {
      void deps.aiGate.run({ kind: 'chat', label: 'Câu 7', target: { page: 'attempt', attemptId: 'e1', qid: 99 } }, () => new Promise<void>((r) => (release = r)));
    });
    const pop = highlightAndOpen(container);
    expect(within(pop).getByRole('textbox', { name: 'Ghi chú' })).toBeDisabled();
    expect(within(pop).getByRole('button', { name: AI_BTN })).toBeDisabled();
    expect(within(pop).getByText('AI đang trả lời ở Câu 7')).toBeInTheDocument();
    act(() => release());
  });

  it('lỗi → popup có dòng lỗi và nút thử lại; thử lại thành công thì hết lỗi', async () => {
    const { ai, container } = setup();
    ai.reply = new Error('boom');
    const pop = highlightAndOpen(container);
    fireEvent.click(within(pop).getByRole('button', { name: AI_BTN }));
    await waitFor(() => expect(within(pop).getByRole('button', { name: 'Thử lại AI soạn' })).toBeInTheDocument());
    expect(within(pop).getByRole('alert')).toHaveTextContent('AI không soạn được ghi chú');
    expect(container.querySelector('mark.hl')).not.toHaveClass('hl--drafting');
    // Đóng rồi mở lại vẫn thấy lỗi.
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(container.querySelector('mark.hl')!);
    const again = screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' });
    expect(within(again).getByRole('alert')).toBeInTheDocument();
    ai.reply = ['Được rồi'];
    fireEvent.click(within(again).getByRole('button', { name: 'Thử lại AI soạn' }));
    await waitFor(() => expect(within(again).getByRole('textbox', { name: 'Ghi chú' })).toHaveValue('Được rồi'));
    expect(within(again).queryByRole('alert')).toBeNull();
  });

  it('"Đến câu" khi đang ở #/notes có cùng câu: về đúng câu trong lượt thi và mở popup', async () => {
    const { ai, container } = setup();
    ai.reply = ['Ghi chú của AI'];
    ai.hold = true;
    const pop = highlightAndOpen(container);
    fireEvent.click(within(pop).getByRole('button', { name: AI_BTN }));
    fireEvent.click(screen.getByRole('link', { name: 'Ghi chú' }));
    expect(screen.getByRole('heading', { name: 'Ghi chú của tôi' })).toBeInTheDocument();
    await tick();
    await act(async () => ai.release());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('AI đã soạn ghi chú ở Câu 1'));
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Đến câu 1' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Ghi chú của tôi' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toHaveValue('Ghi chú của AI');
  });

  it('lượt đã nộp: "Đến câu" mở popup ở trang xem lại; sang #/notes không bật lại popup', async () => {
    const { deps, ai, container, canon } = setup();
    ai.reply = ['Ghi chú của AI'];
    ai.hold = true;
    const pop = highlightAndOpen(container);
    fireEvent.click(within(pop).getByRole('button', { name: AI_BTN }));
    fireEvent.click(screen.getByRole('link', { name: 'Đề thi' }));
    act(() => deps.store.save(submitAttempt(deps.store.get('e1')!, 600)));
    await tick();
    await act(async () => ai.release());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('AI đã soạn ghi chú ở Câu 1'));
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Đến câu 1' }));
    await waitFor(() => expect(screen.getByTestId('result-page')).toBeInTheDocument());
    // Trang xem lại giờ tô đề được: popup của đoạn tô mở ngay tại đó, yêu cầu được nhận.
    expect(await screen.findByRole('dialog', { name: 'Ghi chú cho đoạn tô' })).toBeInTheDocument();
    expect(deps.aiGate.peekOpen()).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Ghi chú' }));
    expect(container.querySelector(`[id^="note-${canon(0)}:"]`)).not.toBeNull();
    await tick();
    expect(screen.queryByRole('dialog', { name: /Câu hỏi/ })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Ghi chú cho đoạn tô' })).toBeNull();
  });
});
