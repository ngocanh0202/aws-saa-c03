import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAttempt, type Mode } from '../engine/attempt';
import { makeDeps, renderApp } from '../test/fixtures';

function setup(mode: Mode) {
  const deps = makeDeps();
  const attempt = createAttempt({ id: 'e1', setId: 1, mode, esl: true, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
  deps.store.save(attempt);
  const qid = attempt.questions[0].qid;
  return { deps, attempt, qid, canon: deps.bank.canonical(qid) };
}

const stemText = (c: HTMLElement) => c.querySelector('.qcard [data-part="stem"]') as HTMLElement;

function firstText(el: Node): Text {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const n = w.nextNode();
  if (!n) throw new Error('no text');
  return n as Text;
}

function select(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const r = document.createRange();
  r.setStart(startNode, startOffset);
  r.setEnd(endNode, endOffset);
  const s = document.getSelection()!;
  s.removeAllRanges();
  s.addRange(r);
  fireEvent(document, new Event('selectionchange'));
}

/** Chọn 4 ký tự đầu ("Stem") của đề câu đang hiện rồi bấm Tô. */
function highlightStem(c: HTMLElement, button = 'Tô') {
  const t = firstText(stemText(c));
  select(t, 0, t, 4);
  fireEvent.click(screen.getByRole('button', { name: button }));
}

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
});

describe('Highlighter — Thi thử', () => {
  it('chọn "Stem" → Tô → có mark và lưu 1 đoạn', () => {
    const { deps, canon } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    highlightStem(container);
    const mark = container.querySelector('mark.hl');
    expect(mark).toHaveTextContent('Stem');
    expect(deps.notes.get(canon)!.highlights).toHaveLength(1);
    expect(deps.notes.get(canon)!.highlights[0]).toMatchObject({ part: 'stem', start: 0, end: 4, text: 'Stem' });
    expect(screen.queryByRole('button', { name: 'Tô' })).not.toBeInTheDocument();
  });

  it('bấm mark → gõ ghi chú → Lưu ghi chú → note lưu, mark có hl--note', () => {
    const { deps, canon } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    highlightStem(container);
    fireEvent.click(container.querySelector('mark.hl')!);
    fireEvent.change(screen.getByRole('textbox', { name: 'Ghi chú' }), { target: { value: 'ghi chú' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    expect(deps.notes.get(canon)!.highlights[0].note).toBe('ghi chú');
    expect(container.querySelector('mark.hl')).toHaveClass('hl--note');
    expect(screen.queryByRole('textbox', { name: 'Ghi chú' })).not.toBeInTheDocument();
  });

  it('Tô + ghi chú mở popup ngay; ô nhập giới hạn 2000 ký tự; Enter trên mark cũng mở', () => {
    const { deps } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    highlightStem(container, 'Tô và ghi chú');
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toHaveAttribute('maxLength', '2000');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Ghi chú' })).not.toBeInTheDocument();
    fireEvent.keyDown(container.querySelector('mark.hl')!, { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toBeInTheDocument();
  });

  it('Esc hoặc bấm ra ngoài thì đóng và tự lưu bản đang gõ', () => {
    const { deps, canon } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    highlightStem(container, 'Tô và ghi chú');
    fireEvent.change(screen.getByRole('textbox', { name: 'Ghi chú' }), { target: { value: 'esc' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(deps.notes.get(canon)!.highlights[0].note).toBe('esc');
    fireEvent.click(container.querySelector('mark.hl')!);
    fireEvent.change(screen.getByRole('textbox', { name: 'Ghi chú' }), { target: { value: 'ngoài' } });
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('textbox', { name: 'Ghi chú' })).not.toBeInTheDocument();
    expect(deps.notes.get(canon)!.highlights[0].note).toBe('ngoài');
  });

  it('gõ dở rồi bấm Câu sau → quay lại → ghi chú vẫn còn, mark hiện lại đúng chữ, không lỗi React', () => {
    const err = vi.spyOn(console, 'error');
    const { deps, canon } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    highlightStem(container, 'Tô và ghi chú');
    fireEvent.change(screen.getByRole('textbox', { name: 'Ghi chú' }), { target: { value: 'dở dang' } });
    fireEvent.click(screen.getByRole('button', { name: 'Câu sau' }));
    expect(deps.notes.get(canon)!.highlights[0].note).toBe('dở dang');
    expect(container.querySelector('mark.hl')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Câu trước' }));
    const mark = container.querySelector('mark.hl');
    expect(mark).toHaveTextContent('Stem');
    expect(mark).toHaveClass('hl--note');
    expect(stemText(container).textContent).toBe(`Stem ${deps.store.get('e1')!.questions[0].qid}`);
    expect(err).not.toHaveBeenCalled();
  });

  it('render lại cùng câu sau khi tô (chọn đáp án) giữ đúng chữ và mark', () => {
    const err = vi.spyOn(console, 'error');
    const { deps, qid } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    highlightStem(container);
    fireEvent.click(container.querySelectorAll('.opt')[0]);
    fireEvent.click(container.querySelectorAll('.opt')[1]);
    expect(stemText(container).textContent).toBe(`Stem ${qid}`);
    expect(container.querySelectorAll('mark.hl')).toHaveLength(1);
    expect(err).not.toHaveBeenCalled();
  });

  it('chọn vắt từ đề sang lựa chọn → không có nút Tô', () => {
    const { deps } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    const opt = container.querySelector('.opt__text')!;
    select(firstText(stemText(container)), 0, firstText(opt), 3);
    expect(screen.queryByRole('button', { name: 'Tô' })).not.toBeInTheDocument();
  });

  it('tô được dòng câu hỏi (prompt)', () => {
    const { deps, canon } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    const t = firstText(container.querySelector('.qcard__prompt')!);
    select(t, 0, t, 6);
    fireEvent.click(screen.getByRole('button', { name: 'Tô' }));
    expect(deps.notes.get(canon)!.highlights[0]).toMatchObject({ part: 'prompt', text: 'Prompt' });
    expect(container.querySelector('.qcard__prompt mark.hl')).toHaveTextContent('Prompt');
  });

  it('Xóa đoạn tô → mark biến mất, highlights rỗng', () => {
    const { deps, canon } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    highlightStem(container);
    fireEvent.click(container.querySelector('mark.hl')!);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa đoạn tô' }));
    expect(container.querySelector('mark.hl')).toBeNull();
    expect(deps.notes.get(canon)!.highlights).toEqual([]);
  });

  it('không có AI (chưa đăng nhập) thì popup không có nút AI', () => {
    const { deps } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    highlightStem(container, 'Tô và ghi chú');
    expect(screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').filter((b) => /AI/.test(b.getAttribute('aria-label') ?? ''))).toHaveLength(0);
  });
});

describe('Highlighter — điện thoại', () => {
  it('thanh Tô cố định đáy; popup là bottom sheet có trích đoạn, nút Đóng và nền mờ', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(max-width: 639px)', addEventListener() {}, removeEventListener() {} }));
    try {
      const { deps, canon } = setup('practice');
      const { container } = renderApp('/exam/e1', deps);
      const t = firstText(stemText(container));
      select(t, 0, t, 4);
      expect(screen.getByRole('toolbar')).toHaveClass('hl-toolbar--bottom');
      fireEvent.click(screen.getByRole('button', { name: 'Tô và ghi chú' }));
      const sheet = screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' });
      expect(sheet).toHaveClass('hl-sheet');
      expect(sheet.querySelector('.hl-quote')).toHaveTextContent('Stem');
      fireEvent.change(screen.getByRole('textbox', { name: 'Ghi chú' }), { target: { value: 'đt' } });
      fireEvent.click(document.querySelector('.hl-backdrop')!);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(deps.notes.get(canon)!.highlights[0].note).toBe('đt');
      fireEvent.click(container.querySelector('mark.hl')!);
      const again = screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' });
      fireEvent.click(within(again).getByRole('button', { name: 'Đóng' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('Highlighter — Thi thật', () => {
  it('chọn chữ không có nút Tô; ghi chú đã có của câu không hiện', () => {
    const { deps, canon } = setup('real');
    deps.notes.save({ qid: canon, updatedAt: 1, highlights: [{ id: 'h1', part: 'stem', start: 0, end: 4, text: 'Stem', note: 'x', updatedAt: 1 }] });
    const { container } = renderApp('/exam/e1', deps);
    expect(container.querySelector('mark')).toBeNull();
    const t = firstText(container.querySelector('.qcard p')!);
    select(t, 0, t, 4);
    expect(screen.queryByRole('button', { name: 'Tô' })).not.toBeInTheDocument();
  });
});
