import type { Question } from '../data/types';
import { addHighlight, type HighlightPart, type QuestionNotes } from '../notes/model';
import { partText } from '../notes/part-text';
import type { NotesStore } from '../notes/store';
import type { AiTool } from './types';

export const HIGHLIGHT_TOOL = 'highlight_keywords';

/** Số cụm tối đa mỗi lần gọi và độ dài tối đa của một cụm. */
export const HIGHLIGHT_MAX_PHRASES = 8;
export const HIGHLIGHT_MAX_LENGTH = 120;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Vị trí cụm trong text: không phân biệt hoa/thường, mọi chuỗi khoảng trắng coi như một. */
export function findPhrase(text: string, phrase: string): { start: number; end: number } | null {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const m = new RegExp(words.map(escape).join('\\s+'), 'i').exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

export interface HighlightResult {
  notes: QuestionNotes;
  highlighted: string[];
  skipped: string[];
  notFound: string[];
}

/**
 * Tô các cụm (tìm trong đề bài rồi dòng câu hỏi), note rỗng. Cụm chồng lên đoạn đã tô (kể cả đoạn vừa
 * tô trong lần này) thì bỏ qua, để không đổi đoạn người học đã tô.
 */
export function highlightPhrases(
  notes: QuestionNotes | undefined,
  question: Question,
  canonicalQid: number,
  phrases: string[],
  newId: () => string,
  now: number,
): HighlightResult {
  let cur: QuestionNotes = notes ?? { qid: canonicalQid, highlights: [], updatedAt: now };
  const highlighted: string[] = [];
  const skipped: string[] = [];
  const notFound: string[] = [];
  const parts: HighlightPart[] = ['stem', 'prompt'];
  for (const phrase of phrases) {
    let done = false;
    for (const part of parts) {
      const text = partText(question, part);
      const at = findPhrase(text, phrase);
      if (!at) continue;
      done = true;
      // Cùng điều kiện gộp của addHighlight (chạm nhau cũng gộp), để không bao giờ gộp vào đoạn có sẵn.
      const overlaps = cur.highlights.some((h) => h.part === part && h.start <= at.end && h.end >= at.start);
      if (overlaps) skipped.push(phrase);
      else {
        cur = addHighlight(cur, { part, ...at, text: text.slice(at.start, at.end) }, text, newId(), now).notes;
        highlighted.push(phrase);
      }
      break;
    }
    if (!done) notFound.push(phrase);
  }
  return { notes: cur, highlighted, skipped, notFound };
}

export interface HighlightToolDeps {
  notes: NotesStore;
  /** Lượt của câu còn là Thi thử đang làm (đọc lại mỗi lần chạy). */
  isOpen: () => boolean;
  question: Question;
  canonicalQid: number;
  newId: () => string;
  now: () => number;
}

/** Tool cho AI tô cụm chữ trong đề của câu đang chat (chỉ tô, không ghi chú). */
export function createHighlightTool(deps: HighlightToolDeps): AiTool {
  return {
    name: HIGHLIGHT_TOOL,
    description:
      'Tô (highlight) các cụm từ khóa then chốt trong đề bài hoặc dòng câu hỏi của câu đang làm, để người học thấy đề đang yêu cầu gì (ràng buộc chi phí, vận hành, thời gian, quy mô, bảo mật…). Chép nguyên văn cụm từ đề, không tô các lựa chọn. Trả về các cụm đã tô, bị bỏ qua (đã tô từ trước) và không tìm thấy.',
    params: { phrases: `Các cụm cần tô, mỗi cụm một dòng, chép nguyên văn từ đề (tối đa ${HIGHLIGHT_MAX_PHRASES} cụm)` },
    run(args) {
      if (!deps.isOpen()) return { error: 'Chỉ tô được khi đang làm Thi thử.' };
      const raw = typeof args.phrases === 'string' ? args.phrases : '';
      const all = raw
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s !== '');
      const phrases = all.filter((s) => s.length <= HIGHLIGHT_MAX_LENGTH).slice(0, HIGHLIGHT_MAX_PHRASES);
      // Cụm quá dài hay vượt số cụm tối đa: báo là không tô, để AI không nói đã tô.
      const dropped = all.filter((s) => !phrases.includes(s));
      const { notes, highlighted, skipped, notFound } = highlightPhrases(
        deps.notes.get(deps.canonicalQid),
        deps.question,
        deps.canonicalQid,
        phrases,
        deps.newId,
        deps.now(),
      );
      if (highlighted.length > 0) deps.notes.save(notes);
      return { highlighted, skipped, notFound: [...notFound, ...dropped] };
    },
  };
}
