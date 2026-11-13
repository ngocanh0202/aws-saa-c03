import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../app/context';
import { busyMessage, targetKey, useAiGate, type AiJobTarget } from '../ai/gate';
import { IconClose, IconDelete, IconHighlight, IconNote, IconResize, IconSave } from '../components/icons';
import type { Question } from '../data/types';
import { applyHighlights, selectionOffsets, type MarkSpec } from './dom';
import { addHighlight, fitsLimit, locate, newHighlightId, NOTE_MAX, removeHighlight, setNote, TOO_LONG_MESSAGE, type HighlightPart, type QuestionNotes } from './model';
import { NoteAiButton } from './NoteAiButton';
import { useMobile } from './use-mobile';
import { usePopupResize } from './usePopupResize';

const POP_WIDTH = 360;

export interface HighlighterProps {
  /** Canonical id: khóa lưu ghi chú. */
  qid: number;
  question: Question;
  stemEl: HTMLElement | null;
  promptEl: HTMLElement | null;
  /** Nhãn câu ("Câu 3") và đích của việc AI, dùng ở Task 8–9. */
  label?: string;
  target?: (highlightId: string) => AiJobTarget;
  /** Nút AI trong popup; mặc định là NoteAiButton (cần label và target). */
  aiSlot?: (ctx: { highlightId: string; text: string }) => ReactNode;
}

interface Box {
  top: number;
  left: number;
  bottom: number;
  width: number;
}

interface Pending {
  part: HighlightPart;
  start: number;
  end: number;
  text: string;
  box: Box | null;
}

interface OpenPop {
  id: string;
  draft: string;
  /** Ghi chú đã lưu lúc mở (hoặc lần đồng bộ gần nhất từ store). */
  base: string;
  box: Box | null;
}

function toBox(r: DOMRect | undefined | null): Box | null {
  if (!r) return null;
  return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width };
}

function rangeBox(r: Range): Box | null {
  return typeof r.getBoundingClientRect === 'function' ? toBox(r.getBoundingClientRect()) : null;
}

/** Dòng của mark gần điểm bấm nhất (đoạn tô dài có thể nằm trên nhiều dòng). */
function markBox(mark: Element, clientY?: number): Box | null {
  const rects = Array.from(mark.getClientRects?.() ?? []);
  if (rects.length === 0) return toBox(mark.getBoundingClientRect?.());
  const hit = clientY === undefined ? undefined : rects.find((r) => clientY >= r.top && clientY <= r.bottom);
  return toBox(hit ?? rects[rects.length - 1]);
}

/** Các <mark> của một đoạn tô (đoạn dài có thể bị tách thành nhiều mark). */
function marksOf(el: HTMLElement, id: string): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('mark[data-hl]')).filter((m) => m.dataset.hl === id);
}

const emptyNotes = (qid: number): QuestionNotes => ({ qid, highlights: [], updatedAt: 0 });

export function Highlighter({ qid, question, stemEl, promptEl, label, target, aiSlot }: HighlighterProps) {
  const { notes: store, now, aiGate } = useApp();
  /** Yêu cầu AI đang chạy trong tab: khóa mọi ô ghi chú (kể cả đoạn đang được soạn). */
  const gateJob = useAiGate();
  const draftingId = gateJob?.kind === 'note' ? gateJob.target.highlightId : undefined;
  const slot =
    aiSlot ??
    (label && target
      ? ({ highlightId, text }: { highlightId: string; text: string }) => (
          <NoteAiButton question={question} qid={qid} highlightId={highlightId} text={text} label={label} target={target(highlightId)} />
        )
      : undefined);
  const notes = useSyncExternalStore(store.subscribe, () => store.get(qid));
  const mobile = useMobile();
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState<OpenPop | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const toolbarPress = useRef(false);

  const elOf = useCallback((part: HighlightPart) => (part === 'stem' ? stemEl : promptEl), [stemEl, promptEl]);

  // Vẽ mark sau mỗi lần dữ liệu đổi; dọn sạch trước lần commit kế tiếp của React để DOM khớp với React.
  useLayoutEffect(() => {
    const parts: [HighlightPart, HTMLElement | null][] = [
      ['stem', stemEl],
      ['prompt', promptEl],
    ];
    for (const [part, el] of parts) {
      if (!el) continue;
      const partText = el.textContent ?? '';
      const marks: MarkSpec[] = [];
      for (const h of notes?.highlights ?? []) {
        if (h.part !== part) continue;
        const at = locate(h, partText);
        if (at) marks.push({ id: h.id, ...at, hasNote: h.note !== '' });
      }
      applyHighlights(el, marks);
      // Đoạn AI đang soạn: nhấp nháy nhẹ.
      if (draftingId) for (const m of marksOf(el, draftingId)) m.classList.add('hl--drafting');
    }
    return () => {
      for (const [, el] of parts) if (el) applyHighlights(el, []);
    };
  }, [notes, stemEl, promptEl, draftingId]);

  // Đoạn chọn hợp lệ → thanh Tô.
  useEffect(() => {
    const onChange = () => {
      if (toolbarPress.current) return;
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return setPending(null);
      const range = sel.getRangeAt(0);
      for (const part of ['stem', 'prompt'] as const) {
        const el = elOf(part);
        const off = el && selectionOffsets(el, range);
        if (off) return setPending({ part, ...off, box: rangeBox(range) });
      }
      setPending(null);
    };
    // Chạm/bấm thanh Tô có thể làm mất đoạn chọn (điện thoại); bỏ qua thay đổi trong lúc đó, nhả tay một lúc thì nghe lại.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUp = () => {
      if (!toolbarPress.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => (toolbarPress.current = false), 400);
    };
    document.addEventListener('selectionchange', onChange);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('mouseup', onUp);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onChange);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('mouseup', onUp);
    };
  }, [elOf]);

  // Bản mới nhất cho các trình nghe sự kiện và lúc unmount.
  const latest = useRef({ open, notes, qid });
  useLayoutEffect(() => {
    latest.current = { open, notes, qid };
  });

  /** Ghi chú của câu đã chạm giới hạn dung lượng (không lưu thêm được). */
  const [tooLong, setTooLong] = useState(false);

  /** Lưu bản đang gõ nếu khác bản đã lưu. Vượt giới hạn dung lượng của câu thì không lưu, trả false. */
  const commit = useCallback(
    (o: OpenPop): boolean => {
      const cur = store.get(latest.current.qid);
      const h = cur?.highlights.find((x) => x.id === o.id);
      if (!cur || !h || h.note === o.draft) return true;
      const next = setNote(cur, o.id, o.draft, now());
      if (!fitsLimit(next)) return false;
      store.save(next);
      return true;
    },
    [store, now],
  );

  const close = useCallback(() => {
    const o = latest.current.open;
    if (!o) return;
    // Quá dài: giữ popup mở kèm câu báo để người học rút gọn.
    if (!commit(o)) return setTooLong(true);
    setTooLong(false);
    setOpen(null);
  }, [commit]);

  const openPop = useCallback(
    (id: string, box: Box | null) => {
      const cur = latest.current.open;
      if (cur) {
        if (cur.id === id) return;
        if (!commit(cur)) return setTooLong(true);
      }
      const note = store.get(latest.current.qid)?.highlights.find((h) => h.id === id)?.note ?? '';
      setOpen({ id, draft: note, base: note, box });
    },
    [commit, store],
  );

  // Đổi câu / rời trang: tự lưu.
  useEffect(
    () => () => {
      const o = latest.current.open;
      if (o) commit(o);
    },
    [commit],
  );

  // Bấm hoặc Enter/Space trên mark → mở popup.
  useEffect(() => {
    const els = [stemEl, promptEl].filter((e): e is HTMLElement => e !== null);
    const markOf = (t: EventTarget | null) => (t instanceof Element ? t.closest('mark[data-hl]') : null);
    const onClick = (e: MouseEvent) => {
      const m = markOf(e.target);
      if (m) openPop((m as HTMLElement).dataset.hl!, markBox(m, e.clientY));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const m = markOf(e.target);
      if (!m) return;
      e.preventDefault();
      openPop((m as HTMLElement).dataset.hl!, markBox(m));
    };
    for (const el of els) {
      el.addEventListener('click', onClick);
      el.addEventListener('keydown', onKey);
    }
    return () => {
      for (const el of els) {
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKey);
      }
    };
  }, [stemEl, promptEl, openPop]);

  // "Đến câu …" của việc AI soạn ghi chú: mở popup của đúng đoạn tô (khi đoạn đó thuộc câu này và
  // yêu cầu nhắm đúng trang/lượt này: cùng câu ở #/notes và trong lượt thi là hai chỗ khác nhau).
  const targetRef = useRef(target);
  useLayoutEffect(() => {
    targetRef.current = target;
  });
  useEffect(() => {
    if (!stemEl && !promptEl) return;
    const take = () => {
      const has = (id: string | undefined) => id !== undefined && !!store.get(latest.current.qid)?.highlights.some((h) => h.id === id);
      const mine = (x: AiJobTarget) => {
        const tgt = targetRef.current;
        return !!tgt && has(x.highlightId) && targetKey(x) === targetKey(tgt(x.highlightId!));
      };
      const t = aiGate.takeOpen(mine);
      if (!t?.highlightId) return;
      const m = [stemEl, promptEl].flatMap((el) => (el ? marksOf(el, t.highlightId!) : []))[0];
      m?.scrollIntoView?.({ block: 'center' });
      openPop(t.highlightId, m ? markBox(m) : null);
    };
    take();
    return aiGate.subscribe(take);
  }, [aiGate, store, stemEl, promptEl, openPop]);

  // Popup đang mở là "chỗ đang nhìn": AI soạn xong đoạn này thì không cần thông báo.
  const viewKey = open && target ? targetKey(target(open.id)) : null;
  useEffect(() => {
    if (!viewKey) return;
    aiGate.setViewing(viewKey);
    return () => {
      if (aiGate.viewing() === viewKey) aiGate.setViewing(null);
    };
  }, [aiGate, viewKey]);

  // Có yêu cầu AI bắt đầu khi đang gõ dở: lưu bản đang gõ trước, để chữ AI nối vào sau chữ của người học.
  const locked = gateJob !== null;
  useEffect(() => {
    const o = latest.current.open;
    if (!locked || !o || o.draft === o.base) return;
    commit(o);
    setOpen({ ...o, base: o.draft });
  }, [locked, commit]);

  // Esc / bấm ra ngoài → đóng (tự lưu).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Khung chứa (vd khung xem câu ở trang Ghi chú) không đóng theo.
        e.preventDefault();
        close();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (popRef.current?.contains(t)) return;
      // Bấm vào mark khác: trình nghe click sẽ lưu bản cũ rồi mở bản mới.
      if (t instanceof Element && t.closest('mark[data-hl]')) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open !== null, close]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đoạn đang mở bị xóa (máy khác, đồng bộ) → đóng; ghi chú đổi từ nơi khác (AI) mà chưa gõ gì → cập nhật ô nhập.
  const openNote = open ? notes?.highlights.find((h) => h.id === open.id) : undefined;
  useEffect(() => {
    if (!open) return;
    if (!openNote) return setOpen(null);
    if (openNote.note !== open.base && open.draft === open.base) setOpen({ ...open, draft: openNote.note, base: openNote.note });
  }, [open, openNote]);

  const resize = usePopupResize({ ref: popRef, openKey: open ? `${open.id}:${mobile ? 'm' : 'd'}` : null, mobile, onDismiss: close });

  useEffect(() => {
    if (open) popRef.current?.querySelector('textarea')?.focus();
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (withNote: boolean) => {
    toolbarPress.current = false;
    if (!pending) return;
    const el = elOf(pending.part);
    if (!el) return;
    const cur = store.get(qid) ?? emptyNotes(qid);
    const { notes: next, id } = addHighlight(cur, pending, el.textContent ?? '', newHighlightId(), now());
    document.getSelection()?.removeAllRanges();
    setPending(null);
    if (!fitsLimit(next)) return setTooLong(true);
    store.save(next);
    if (withNote) openPop(id, pending.box);
  };

  const remove = () => {
    if (!open) return;
    const cur = store.get(qid);
    if (cur) store.save(removeHighlight(cur, open.id, now()));
    setOpen(null);
  };

  const save = () => {
    if (!open) return;
    commit(open);
    setOpen(null);
  };

  const keepSelection = {
    onPointerDown: () => {
      toolbarPress.current = true;
    },
    onMouseDown: (e: ReactMouseEvent) => {
      toolbarPress.current = true;
      e.preventDefault();
    },
  };

  let toolbar: ReactNode = null;
  if (pending && !open) {
    const style = mobile || !pending.box ? undefined : { top: pending.box.bottom + 8, left: Math.max(8, pending.box.left) };
    toolbar = (
      <div className={`hl-toolbar${mobile ? ' hl-toolbar--bottom' : ''}`} style={style} role="toolbar" aria-label="Tô đoạn đã chọn" {...keepSelection}>
        <button type="button" className="hl-btn" aria-label="Tô" title="Tô" onClick={() => add(false)}>
          <IconHighlight />
        </button>
        <button type="button" className="hl-btn" aria-label="Tô và ghi chú" title="Tô và ghi chú" onClick={() => add(true)}>
          <IconNote />
        </button>
      </div>
    );
  }

  let popup: ReactNode = null;
  if (open && openNote) {
    const body = (
      <>
        {mobile && <blockquote className="hl-quote">{openNote.text}</blockquote>}
        {tooLong && (
          <p className="note-form__error" role="alert">
            {TOO_LONG_MESSAGE}
          </p>
        )}
        <textarea
          aria-label="Ghi chú"
          maxLength={NOTE_MAX}
          value={open.draft}
          placeholder="Ghi chú cho đoạn này…"
          disabled={locked}
          onChange={(e) => setOpen({ ...open, draft: e.target.value })}
        />
        {gateJob && (
          <p className="hl-pop__locked" role="note">
            {busyMessage(gateJob)}
          </p>
        )}
        <div className="hl-pop__actions">
          {slot?.({ highlightId: open.id, text: openNote.text })}
          <button type="button" className="hl-btn" aria-label="Xóa đoạn tô" title="Xóa đoạn tô" onClick={remove}>
            <IconDelete />
          </button>
          {mobile && (
            <button type="button" className="hl-btn" aria-label="Đóng" title="Đóng" onClick={close}>
              <IconClose />
            </button>
          )}
          <button type="button" className="hl-btn hl-btn--primary" aria-label="Lưu ghi chú" title="Lưu ghi chú" onClick={save}>
            <IconSave />
          </button>
        </div>
      </>
    );
    if (mobile) {
      popup = (
        <>
          <div className="hl-backdrop" onClick={close} />
          <div ref={popRef} className="hl-sheet" style={resize.style} role="dialog" aria-label="Ghi chú cho đoạn tô">
            <div
              className="hl-sheet__grab"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Kéo lên để mở rộng, kéo xuống để thu nhỏ"
              title="Kéo lên để mở rộng, kéo xuống để thu nhỏ"
              tabIndex={0}
              {...resize.handlers}
            />
            {body}
          </div>
        </>
      );
    } else {
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(POP_WIDTH, vw - 16);
      const box = open.box;
      const left = box ? Math.min(Math.max(8, box.left - 16), Math.max(8, vw - width - 8 + window.scrollX)) : 8;
      const arrow = box ? Math.min(Math.max(12, box.left + Math.min(box.width / 2, 24) - left - 6), width - 24) : 24;
      const style = { top: (box?.bottom ?? 0) + 10, left, width, ['--arrow' as string]: `${arrow}px`, ...resize.style };
      popup = (
        <div ref={popRef} className="hl-pop" style={style} role="dialog" aria-label="Ghi chú cho đoạn tô">
          {body}
          <button type="button" className="hl-pop__grip" aria-label="Kéo để đổi cỡ ô ghi chú" title="Kéo để đổi cỡ ô ghi chú" {...resize.handlers}>
            <IconResize size={14} />
          </button>
        </div>
      );
    }
  }

  // Không thêm được đoạn tô (quá dài) khi không có popup: báo ở góc dưới, bấm để đóng.
  const notice =
    tooLong && !popup ? (
      <button type="button" className="hl-limit" role="alert" onClick={() => setTooLong(false)}>
        {TOO_LONG_MESSAGE}
      </button>
    ) : null;
  if (!toolbar && !popup && !notice) return null;
  return createPortal(
    <div className="hl-layer" lang="vi">
      {toolbar}
      {popup}
      {notice}
    </div>,
    document.body,
  );
}
