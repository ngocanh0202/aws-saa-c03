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
    expect(deps.notes.get(canon)).toBeUndefined();
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

/** jsdom không có layout: popup/sheet có cỡ theo style (mặc định 360×150 / sheet cao 300), góc trên trái popup ở (100, 200). */
function mockLayout() {
  const orig = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const pop = this.classList.contains('hl-pop');
    const sheet = this.classList.contains('hl-sheet');
    if (!pop && !sheet) return orig.call(this);
    const w = parseFloat(this.style.width) || (pop ? 360 : window.innerWidth);
    const h = parseFloat(this.style.height) || (pop ? 150 : 300);
    const left = pop ? 100 : 0;
    const top = pop ? 200 : window.innerHeight - h;
    return { left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top, toJSON() {} } as DOMRect;
  });
}

const SIZE_KEY = 'saa-c03:note-popup-size:v1';

describe('Highlighter — đổi cỡ ô ghi chú (máy tính)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  function openPop() {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 700);
    mockLayout();
    const { deps, canon } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    highlightStem(container, 'Tô và ghi chú');
    const pop = screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' });
    const grip = within(pop).getByRole('button', { name: 'Kéo để đổi cỡ ô ghi chú' });
    return { deps, canon, container, pop, grip };
  }

  it('kéo góc phải dưới làm popup to ra, không quá mép màn hình, không nhỏ hơn cỡ mặc định; lưu cỡ', () => {
    const { pop, grip } = openPop();
    expect(grip).toHaveAttribute('title', 'Kéo để đổi cỡ ô ghi chú');
    fireEvent.pointerDown(grip, { pointerId: 1, clientX: 460, clientY: 350, button: 0 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 560, clientY: 400 });
    expect(pop.style.width).toBe('460px');
    expect(pop.style.height).toBe('200px');
    // Vượt mép: phải = 1000 - 8 - 100, dưới = 700 - 8 - 200.
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 5000, clientY: 5000 });
    expect(pop.style.width).toBe('892px');
    expect(pop.style.height).toBe('492px');
    // Nhỏ hơn mặc định: giữ mặc định.
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(pop.style.width).toBe('360px');
    expect(pop.style.height).toBe('150px');
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 500, clientY: 380 });
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: 500, clientY: 380 });
    expect(JSON.parse(localStorage.getItem(SIZE_KEY)!)).toEqual({ desktop: { w: 400, h: 180 } });
    // Thả rồi di chuột: không đổi nữa.
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 700, clientY: 600 });
    expect(pop.style.width).toBe('400px');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('phím mũi tên trên góc kéo đổi cỡ 16px', () => {
    const { pop, grip } = openPop();
    fireEvent.keyDown(grip, { key: 'ArrowRight' });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    expect(pop.style.width).toBe('376px');
    expect(pop.style.height).toBe('182px');
    fireEvent.keyDown(grip, { key: 'ArrowLeft' });
    fireEvent.keyDown(grip, { key: 'ArrowUp' });
    expect(pop.style.width).toBe('360px');
    expect(pop.style.height).toBe('166px');
    expect(JSON.parse(localStorage.getItem(SIZE_KEY)!)).toEqual({ desktop: { w: 360, h: 166 } });
  });

  it('mở lại thì dùng cỡ đã lưu (kẹp theo màn hình); dữ liệu hỏng thì bỏ qua', () => {
    localStorage.setItem(SIZE_KEY, JSON.stringify({ desktop: { w: 500, h: 9999 } }));
    const { pop } = openPop();
    expect(pop.style.width).toBe('500px');
    expect(pop.style.height).toBe('492px');
    fireEvent.keyDown(document, { key: 'Escape' });
    localStorage.setItem(SIZE_KEY, '{hỏng');
    fireEvent.click(document.querySelector('mark.hl')!);
    const again = screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' });
    expect(again.style.width).toBe('360px');
    expect(again.style.height).toBe('');
  });
});

describe('Highlighter — đổi cỡ ô ghi chú (điện thoại)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  function openSheet() {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(max-width: 639px)', addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('innerHeight', 800);
    mockLayout();
    const { deps, canon } = setup('practice');
    const { container } = renderApp('/exam/e1', deps);
    const t = firstText(stemText(container));
    select(t, 0, t, 4);
    fireEvent.click(screen.getByRole('button', { name: 'Tô và ghi chú' }));
    const sheet = screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' });
    const handle = within(sheet).getByRole('separator', { name: 'Kéo lên để mở rộng, kéo xuống để thu nhỏ' });
    return { deps, canon, container, sheet, handle };
  }

  it('kéo thanh lên làm sheet cao hơn, tối đa 90vh; kéo xuống không thấp hơn mặc định; lưu cỡ', () => {
    const { sheet, handle } = openSheet();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 180, clientY: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 180, clientY: 400 });
    expect(sheet.style.height).toBe('400px');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 180, clientY: 0 });
    expect(sheet.style.height).toBe('720px');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 180, clientY: 560 });
    expect(sheet.style.height).toBe('300px');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 180, clientY: 450 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 180, clientY: 450 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SIZE_KEY)!)).toEqual({ mobile: { h: 350 } });
  });

  it('kéo xuống quá cỡ nhỏ nhất hơn 80px thì đóng và tự lưu bản đang gõ', () => {
    const { deps, canon, handle } = openSheet();
    fireEvent.change(screen.getByRole('textbox', { name: 'Ghi chú' }), { target: { value: 'kéo đóng' } });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 180, clientY: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 180, clientY: 570 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 180, clientY: 570 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 180, clientY: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 180, clientY: 590 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 180, clientY: 590 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deps.notes.get(canon)!.highlights[0].note).toBe('kéo đóng');
  });

  it('phím mũi tên trên thanh kéo đổi cỡ 10vh; mở lại dùng cỡ đã lưu', () => {
    const { container, sheet, handle } = openSheet();
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(sheet.style.height).toBe('380px');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(sheet.style.height).toBe('380px');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(sheet.style.height).toBe('300px');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    fireEvent.click(document.querySelector('.hl-backdrop')!);
    fireEvent.click(container.querySelector('mark.hl')!);
    expect(screen.getByRole('dialog', { name: 'Ghi chú cho đoạn tô' }).style.height).toBe('380px');
  });
});
