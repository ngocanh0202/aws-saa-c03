import { setLabel } from '../app/format';
import type { Bank } from '../data/bank';
import { htmlToText } from '../data/html-text';
import type { Attempt, Mode } from '../engine/attempt';
import { markGuideOpened } from '../engine/actions';
import { isCorrect } from '../engine/scoring';
import type { AttemptStore } from '../storage/storage';
import type { AiTool } from './types';

/** Một lần người học đã trả lời câu này. */
export interface SearchTry {
  attemptId: string;
  /** Vị trí câu trong lượt, bắt đầu từ 1. */
  position: number;
  /** 'YYYY-MM-DD' theo giờ máy, từ submittedAt ?? startedAt. */
  date: string;
  mode: Mode;
  submitted: boolean;
  /** Chữ của các lựa chọn đã chọn (không dùng nhãn A/B/C vì thứ tự mỗi lượt mỗi khác). */
  chosen: string[];
  correct: boolean;
}

export interface SearchHit {
  qid: number;
  /** "Đề 3 · Câu 12" theo lần làm mới nhất. */
  label: string;
  /** Câu đang hỏi trong phiên chat hiện tại. */
  current: boolean;
  question: string;
  /** Theo thứ tự gốc. */
  options: { text: string; correct: boolean }[];
  services: string[];
  /** Mới nhất trước. */
  tries: SearchTry[];
}

export interface SearchContext {
  setId: number;
  attemptId: string;
  qid: number;
}

export const SEARCH_LIMIT = 5;

type SearchBank = Pick<Bank, 'questions' | 'meta' | 'services'>;

function isoDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Tìm câu người học đã trả lời trong các lượt cùng đề. Bỏ lượt Thi thật còn đang làm (không để lộ
 * đáp án bài thi thật) và lượt incompatible. Khớp theo từ khóa trên đề, lựa chọn và tên service.
 */
export function searchAnswered(query: string, ctx: SearchContext, attempts: Attempt[], bank: SearchBank, limit = SEARCH_LIMIT): SearchHit[] {
  const phrase = query.toLowerCase().replace(/\s+/g, ' ').trim();
  const tokens = [...new Set(phrase.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2))];
  if (tokens.length === 0) return [];

  const byQid = new Map<number, { tries: (SearchTry & { at: number })[] }>();
  for (const a of attempts) {
    if (a.setId !== ctx.setId || a.status === 'incompatible') continue;
    if (a.mode === 'real' && a.status === 'in-progress') continue;
    const at = a.submittedAt ?? a.startedAt;
    a.questions.forEach((aq, i) => {
      const selected = a.answers[aq.qid];
      const q = bank.questions.get(aq.qid);
      if (!q || !selected?.length) return;
      const text = (key: string) => {
        const t = q.options.find((o) => o.key === key)?.text ?? '';
        return q.html ? htmlToText(t) : t;
      };
      const entry = byQid.get(aq.qid) ?? { tries: [] };
      entry.tries.push({
        attemptId: a.id,
        position: i + 1,
        date: isoDate(at),
        mode: a.mode,
        submitted: a.status === 'submitted',
        chosen: selected.map(text),
        correct: isCorrect(selected, q.answer),
        at,
      });
      byQid.set(aq.qid, entry);
    });
  }

  const scored: { hit: SearchHit; score: number; at: number }[] = [];
  for (const [qid, { tries }] of byQid) {
    const q = bank.questions.get(qid)!;
    const plain = (s: string) => (q.html ? htmlToText(s) : s);
    const question = [plain(q.stem), q.prompt ? plain(q.prompt) : ''].filter(Boolean).join('\n');
    const options = q.options.map((o) => ({ text: plain(o.text), correct: q.answer.includes(o.key) }));
    const serviceIds = bank.meta.get(qid)?.services ?? [];
    const services = serviceIds.map((id) => bank.services.get(id)?.name ?? id);
    const haystack = [question, ...options.map((o) => o.text), ...services, ...serviceIds].join('\n').toLowerCase().replace(/\s+/g, ' ');
    const score = tokens.filter((t) => haystack.includes(t)).length + (haystack.includes(phrase) ? 2 : 0);
    if (score < Math.max(1, Math.ceil(tokens.length / 2))) continue;
    tries.sort((x, y) => y.at - x.at);
    const latest = tries[0];
    scored.push({
      score,
      at: latest.at,
      hit: {
        qid,
        label: `${setLabel(ctx.setId)} · Câu ${latest.position}`,
        current: tries.some((t) => t.attemptId === ctx.attemptId) && qid === ctx.qid,
        question,
        options,
        services,
        tries: tries.map(({ at: _at, ...t }) => t),
      },
    });
  }
  return scored
    .sort((x, y) => y.score - x.score || y.at - x.at)
    .slice(0, limit)
    .map((s) => s.hit);
}

export const SEARCH_TOOL = 'find_answered_questions';

/**
 * Bọc searchAnswered thành tool cho Gemini. Câu tìm được thuộc lượt Thi thử chưa nộp thì gắn nhãn
 * "đã xem hướng dẫn" ở đúng lượt đó (tool lộ đáp án đúng, giống mở hướng dẫn).
 */
export function createSearchTool(store: AttemptStore, bank: SearchBank, ctx: SearchContext): AiTool {
  return {
    name: SEARCH_TOOL,
    description:
      'Tìm các câu người học đã trả lời trong cùng đề (lượt đang làm và các lượt cũ). Trả về đề, các lựa chọn, đáp án đúng và những lần người học đã làm câu đó.',
    params: { query: 'Từ khóa tiếng Anh hoặc tên dịch vụ AWS của câu cần tìm' },
    run(args) {
      const query = typeof args.query === 'string' ? args.query : '';
      const results = searchAnswered(query, ctx, store.list(), bank);
      for (const hit of results) {
        for (const t of hit.tries) {
          if (t.mode !== 'practice' || t.submitted) continue;
          const latest = store.get(t.attemptId);
          if (latest && latest.status === 'in-progress' && !latest.guideOpened.includes(hit.qid)) store.save(markGuideOpened(latest, hit.qid));
        }
      }
      return { results };
    },
  };
}
