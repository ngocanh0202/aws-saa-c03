export interface MarkSpec {
  id: string;
  start: number;
  end: number;
  hasNote: boolean;
}

/** Đoạn chọn nằm trọn trong container và không rỗng → vị trí theo textContent; ngược lại null. */
export function selectionOffsets(
  container: HTMLElement,
  range: Range,
): { start: number; end: number; text: string } | null {
  if (range.collapsed) return null;
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const end = start + range.toString().length;
  const text = (container.textContent ?? '').slice(start, end);
  if (end <= start || text.trim() === '') return null;
  return { start, end, text };
}

function removeMarks(container: HTMLElement): void {
  container.querySelectorAll('mark[data-hl]').forEach((m) => m.replaceWith(...Array.from(m.childNodes)));
  container.normalize();
}

/** Bỏ mọi <mark data-hl> cũ (gộp lại text node), rồi bọc các đoạn mới. Không đụng thẻ khác/ảnh. */
export function applyHighlights(container: HTMLElement, marks: MarkSpec[]): void {
  removeMarks(container);
  const sorted = [...marks].filter((m) => m.end > m.start).sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return;

  const nodes: { node: Text; from: number }[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let pos = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, from: pos });
    pos += (n as Text).length;
  }

  // Đoạn chồng nhau (không nên xảy ra) bị bỏ để không lồng <mark>.
  let lastEnd = -1;
  const kept = sorted.filter((m) => {
    if (m.start < lastEnd) return false;
    lastEnd = m.end;
    return true;
  });

  for (const { node, from } of nodes) {
    const to = from + node.length;
    const segs = kept
      .filter((m) => m.start < to && m.end > from)
      .map((m) => ({ m, a: Math.max(m.start, from) - from, b: Math.min(m.end, to) - from }));
    // Từ cuối về đầu để các vị trí phía trước không bị lệch sau khi tách.
    for (let i = segs.length - 1; i >= 0; i--) {
      const { m, a, b } = segs[i];
      if (b < node.length) node.splitText(b);
      const mid = a > 0 ? node.splitText(a) : node;
      const el = document.createElement('mark');
      el.dataset.hl = m.id;
      el.className = m.hasNote ? 'hl hl--note' : 'hl';
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `Đoạn đã tô: ${mid.data}`);
      mid.replaceWith(el);
      el.appendChild(mid);
    }
  }
}
