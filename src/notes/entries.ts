import { setLabel } from '../app/format';
import { normalizeSearch } from '../components/GeminiChat';
import type { SetsFile } from '../data/types';
import type { QuestionNotes } from './model';

export type NoteSource = 'highlight' | 'ai' | 'manual';

/** Một mục trên trang Ghi chú: đoạn tô có ghi chú, hoặc một NoteItem. */
export interface NoteEntry {
  /** Duy nhất trên trang: `${qid}:${id}`. */
  key: string;
  qid: number;
  source: NoteSource;
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

export const SOURCE_LABEL: Record<NoteSource, string> = {
  highlight: 'Tô đề',
  ai: 'Câu trả lời AI',
  manual: 'Tự ghi chú',
};

/** Đoạn tô chỉ thành mục khi đã có ghi chú. */
export function toEntries(list: QuestionNotes[]): NoteEntry[] {
  const out: NoteEntry[] = [];
  for (const n of list) {
    for (const h of n.highlights) {
      if (h.note.trim() === '') continue;
      out.push({ key: `${n.qid}:${h.id}`, qid: n.qid, source: 'highlight', id: h.id, title: h.text, content: h.note, updatedAt: h.updatedAt });
    }
    for (const it of n.items ?? []) {
      out.push({ key: `${n.qid}:${it.id}`, qid: n.qid, source: it.kind, id: it.id, title: it.title, content: it.content, updatedAt: it.updatedAt });
    }
  }
  return out;
}

const isMain = (qid: number) => qid >= 10000;

/** Đề của câu (theo canonical id): câu main theo id, câu sub theo sets.json; không thuộc đề nào thì null (kho dự phòng). */
export function noteSetId(qid: number, sets: SetsFile): number | null {
  if (isMain(qid)) return Math.floor(qid / 100);
  return sets.sets.find((s) => s.questionIds.includes(qid))?.id ?? null;
}

const RESERVE = 'Kho dự phòng';

function setName(set: number | null): string {
  return set === null ? RESERVE : setLabel(set);
}

/** "Main 3 · Câu 12" / "Đề 2 · Câu 245" / "Kho dự phòng · Câu 480". */
export function noteLabel(qid: number, sets: SetsFile): string {
  const set = noteSetId(qid, sets);
  return `${setName(set)} · Câu ${isMain(qid) ? qid % 100 : qid}`;
}

export type SortKey = 'newest' | 'oldest' | 'question';

/** Khóa sắp theo đề rồi số câu: đề main sau đề sub, kho dự phòng cuối. */
function questionOrder(qid: number, sets: SetsFile): [number, number] {
  const set = noteSetId(qid, sets);
  return [set ?? Number.MAX_SAFE_INTEGER, qid];
}

export function sortEntries(entries: NoteEntry[], by: SortKey, sets: SetsFile): NoteEntry[] {
  const out = [...entries];
  if (by === 'newest') out.sort((a, b) => b.updatedAt - a.updatedAt);
  else if (by === 'oldest') out.sort((a, b) => a.updatedAt - b.updatedAt);
  else
    out.sort((a, b) => {
      const [sa, qa] = questionOrder(a.qid, sets);
      const [sb, qb] = questionOrder(b.qid, sets);
      return sa - sb || qa - qb || b.updatedAt - a.updatedAt;
    });
  return out;
}

export type GroupKey = 'set' | 'question' | 'source';

export const GROUP_LABEL: Record<GroupKey, string> = { set: 'Đề', question: 'Câu hỏi', source: 'Nguồn' };

export interface EntryGroup {
  key: string;
  label: string;
  count: number;
  /** Tầng con (còn tiêu chí gộp) hoặc các mục (tầng cuối). */
  groups?: EntryGroup[];
  entries?: NoteEntry[];
}

function groupOf(e: NoteEntry, key: GroupKey, sets: SetsFile): { key: string; label: string } {
  if (key === 'source') return { key: e.source, label: SOURCE_LABEL[e.source] };
  if (key === 'question') return { key: String(e.qid), label: noteLabel(e.qid, sets) };
  const set = noteSetId(e.qid, sets);
  return { key: String(set ?? 'reserve'), label: setName(set) };
}

/**
 * Gộp nhiều tầng theo `keys` (thứ tự tự do, tầng đầu ở ngoài). Giữ thứ tự mục đã sắp; nhóm xếp theo lần xuất
 * hiện đầu tiên. `keys` rỗng → [].
 */
export function groupEntries(entries: NoteEntry[], keys: GroupKey[], sets: SetsFile): EntryGroup[] {
  if (keys.length === 0) return [];
  const [head, ...rest] = keys;
  const groups = new Map<string, { label: string; entries: NoteEntry[] }>();
  for (const e of entries) {
    const g = groupOf(e, head, sets);
    let bucket = groups.get(g.key);
    if (!bucket) groups.set(g.key, (bucket = { label: g.label, entries: [] }));
    bucket.entries.push(e);
  }
  return [...groups].map(([key, g]) => ({
    key,
    label: g.label,
    count: g.entries.length,
    ...(rest.length > 0 ? { groups: groupEntries(g.entries, rest, sets) } : { entries: g.entries }),
  }));
}

/** Tìm không dấu trên tiêu đề, nội dung và nhãn câu. */
export function matchesEntry(e: NoteEntry, needle: string, sets: SetsFile): boolean {
  if (needle === '') return true;
  return normalizeSearch([e.title, e.content, noteLabel(e.qid, sets)].join('\n')).includes(needle);
}
