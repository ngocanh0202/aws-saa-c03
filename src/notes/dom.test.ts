import { describe, expect, it } from 'vitest';
import { applyHighlights, selectionOffsets } from './dom';

function setup(html: string) {
  document.body.innerHTML = `<div id="c">${html}</div><p id="o">other</p>`;
  return document.getElementById('c') as HTMLElement;
}
const textNodeOf = (el: Element, text: string): Text => {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if ((n.textContent ?? '').includes(text)) return n as Text;
  throw new Error('no node');
};

describe('selectionOffsets', () => {
  it('tính vị trí xuyên thẻ lồng', () => {
    const c = setup('<p>Main stem <strong>10101</strong> text</p>');
    const r = document.createRange();
    r.setStart(textNodeOf(c, 'Main stem'), 5);
    r.setEnd(textNodeOf(c, '10101'), 3);
    expect(selectionOffsets(c, r)).toEqual({ start: 5, end: 13, text: 'stem 101' });
  });
  it('vắt ra ngoài container → null', () => {
    const c = setup('<p>abc</p>');
    const r = document.createRange();
    r.setStart(textNodeOf(c, 'abc'), 1);
    r.setEnd(document.getElementById('o')!.firstChild!, 2);
    expect(selectionOffsets(c, r)).toBeNull();
  });
  it('chỉ khoảng trắng → null', () => {
    const c = setup('<p>a   b</p>');
    const r = document.createRange();
    const t = textNodeOf(c, 'a   b');
    r.setStart(t, 1);
    r.setEnd(t, 4);
    expect(selectionOffsets(c, r)).toBeNull();
  });
});

describe('applyHighlights', () => {
  it('bọc đoạn xuyên thẻ, giữ textContent và thẻ khác', () => {
    const c = setup('<p>Main stem <strong>10101</strong> text</p>');
    const before = c.textContent;
    applyHighlights(c, [{ id: 'h1', start: 5, end: 13, hasNote: true }]);
    const marks = c.querySelectorAll('mark[data-hl="h1"]');
    expect(marks).toHaveLength(2);
    expect(marks[1].parentElement?.tagName).toBe('STRONG');
    expect(marks[0].className).toBe('hl hl--note');
    expect(marks[0].getAttribute('role')).toBe('button');
    expect(marks[0].getAttribute('tabindex')).toBe('0');
    expect(marks[0].getAttribute('aria-label')).toBe('Đoạn đã tô: stem ');
    expect(c.textContent).toBe(before);
    expect(c.querySelector('strong')).not.toBeNull();
  });
  it('giữ ảnh', () => {
    const c = setup('<p>ab<img src="x.png" alt="">cd</p>');
    applyHighlights(c, [{ id: 'h', start: 1, end: 3, hasNote: false }]);
    expect(c.querySelector('img')).not.toBeNull();
    expect(c.textContent).toBe('abcd');
    expect(c.querySelector('mark')!.className).toBe('hl');
  });
  it('idempotent, không lồng mark, sắp xếp theo start', () => {
    const c = setup('<p>Main stem text</p>');
    const marks = [
      { id: 'b', start: 10, end: 14, hasNote: false },
      { id: 'a', start: 0, end: 4, hasNote: false },
    ];
    applyHighlights(c, marks);
    const once = c.innerHTML;
    applyHighlights(c, marks);
    expect(c.innerHTML).toBe(once);
    expect(c.querySelector('mark mark')).toBeNull();
    expect(c.textContent).toBe('Main stem text');
    expect(c.querySelectorAll('mark')).toHaveLength(2);
  });
  it('mảng rỗng gỡ hết mark', () => {
    const c = setup('<p>abc</p>');
    applyHighlights(c, [{ id: 'a', start: 0, end: 2, hasNote: false }]);
    applyHighlights(c, []);
    expect(c.querySelector('mark')).toBeNull();
    expect(c.innerHTML).toBe('<p>abc</p>');
  });
});
