export type HighlightPart = 'stem' | 'prompt';

export interface Highlight {
  id: string;
  part: HighlightPart;
  start: number;
  end: number;
  text: string;
  note: string;
  updatedAt: number;
}

/** Ghi chú tiêu đề + nội dung: đánh dấu câu trả lời AI ('ai') hoặc tự ghi ('manual'). */
export interface NoteItem {
  id: string;
  kind: 'ai' | 'manual';
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionNotes {
  /** Canonical id. */
  qid: number;
  highlights: Highlight[];
  /** Bản cũ không có trường này. */
  items?: NoteItem[];
  updatedAt: number;
}

export const TITLE_MAX = 200;
export const ITEM_CONTENT_MAX = 10_000;
/** Rules Firebase cho 100 000 ký tự JSON mỗi câu; chừa khoảng an toàn. */
export const NOTES_JSON_MAX = 90_000;

export const NOTE_MAX = 2000;

export function newHighlightId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const clip = (s: string) => s.slice(0, NOTE_MAX);

export function addHighlight(
  notes: QuestionNotes,
  h: { part: HighlightPart; start: number; end: number; text: string },
  partText: string,
  id: string,
  now: number,
): { notes: QuestionNotes; id: string } {
  let start = h.start;
  let end = h.end;
  const merged: Highlight[] = [];
  const rest: Highlight[] = [];
  for (const o of notes.highlights) {
    if (o.part === h.part && o.start <= h.end && o.end >= h.start) {
      merged.push(o);
      start = Math.min(start, o.start);
      end = Math.max(end, o.end);
    } else rest.push(o);
  }
  const resultId = merged[0]?.id ?? id;
  const note = clip(merged.map((o) => o.note).filter((n) => n !== '').join('\n\n'));
  const result: Highlight = { id: resultId, part: h.part, start, end, text: partText.slice(start, end), note, updatedAt: now };
  return { notes: { ...notes, highlights: [...rest, result], updatedAt: now }, id: resultId };
}

export function setNote(notes: QuestionNotes, id: string, note: string, now: number): QuestionNotes {
  return {
    ...notes,
    highlights: notes.highlights.map((h) => (h.id === id ? { ...h, note: clip(note), updatedAt: now } : h)),
    updatedAt: now,
  };
}

export function removeHighlight(notes: QuestionNotes, id: string, now: number): QuestionNotes {
  return { ...notes, highlights: notes.highlights.filter((h) => h.id !== id), updatedAt: now };
}

export function locate(h: Highlight, partText: string): { start: number; end: number } | null {
  if (partText.slice(h.start, h.end) === h.text) return { start: h.start, end: h.end };
  if (h.text === '') return null;
  let best = -1;
  for (let i = partText.indexOf(h.text); i !== -1; i = partText.indexOf(h.text, i + 1)) {
    if (best === -1 || Math.abs(i - h.start) < Math.abs(best - h.start)) best = i;
  }
  return best === -1 ? null : { start: best, end: best + h.text.length };
}

export function mergeNotes(
  local: QuestionNotes | undefined,
  remote: QuestionNotes | undefined,
): 'local' | 'remote' | 'same' {
  if (!local && !remote) return 'same';
  if (!local) return 'remote';
  if (!remote) return 'local';
  if (local.updatedAt > remote.updatedAt) return 'local';
  if (local.updatedAt < remote.updatedAt) return 'remote';
  return JSON.stringify(local) === JSON.stringify(remote) ? 'same' : 'remote';
}

const clipTitle = (s: string) => s.trim().slice(0, TITLE_MAX);
const clipContent = (s: string) => s.slice(0, ITEM_CONTENT_MAX);

export function addItem(
  notes: QuestionNotes | undefined,
  qid: number,
  item: { kind: NoteItem['kind']; title: string; content: string },
  id: string,
  now: number,
): QuestionNotes {
  const base = notes ?? { qid, highlights: [], updatedAt: now };
  const next: NoteItem = { id, kind: item.kind, title: clipTitle(item.title), content: clipContent(item.content), createdAt: now, updatedAt: now };
  return { ...base, items: [...(base.items ?? []), next], updatedAt: now };
}

export function updateItem(notes: QuestionNotes, id: string, patch: { title?: string; content?: string }, now: number): QuestionNotes {
  return {
    ...notes,
    items: (notes.items ?? []).map((it) =>
      it.id === id
        ? {
            ...it,
            ...(patch.title !== undefined ? { title: clipTitle(patch.title) } : {}),
            ...(patch.content !== undefined ? { content: clipContent(patch.content) } : {}),
            updatedAt: now,
          }
        : it,
    ),
    updatedAt: now,
  };
}

export function removeItem(notes: QuestionNotes, id: string, now: number): QuestionNotes {
  return { ...notes, items: (notes.items ?? []).filter((it) => it.id !== id), updatedAt: now };
}

export function findItem(notes: QuestionNotes | undefined, kind: NoteItem['kind'], title: string, content: string): NoteItem | undefined {
  const t = clipTitle(title);
  const c = clipContent(content);
  return notes?.items?.find((it) => it.kind === kind && it.title === t && it.content === c);
}

/** Còn trong giới hạn dung lượng để đồng bộ được. */
export function fitsLimit(notes: QuestionNotes): boolean {
  return JSON.stringify(notes).length <= NOTES_JSON_MAX;
}

export const TOO_LONG_MESSAGE = 'Ghi chú của câu này đã quá dài, hãy xóa bớt.';
