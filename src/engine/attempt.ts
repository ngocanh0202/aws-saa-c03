import type { Domain, Question, QuestionMeta, SetsFile } from '../data/types';
import { mulberry32, shuffle, type Rng } from './rng';

export type Mode = 'real' | 'practice';

export const SWAP_COUNT = 10;
export const EXAM_MINUTES = 130;
export const ESL_EXTRA_MINUTES = 30;

export interface AttemptQuestion {
  qid: number;
  domain: Domain;
  optionOrder: string[];
}

export interface Attempt {
  id: string;
  setId: number;
  mode: Mode;
  seed: number;
  esl: boolean;
  startedAt: number;
  endsAt?: number;
  questions: AttemptQuestion[];
  answers: Record<number, string[]>;
  flagged: number[];
  guideOpened: number[];
  submittedAt?: number;
  status: 'in-progress' | 'submitted' | 'incompatible';
}

export interface CreateAttemptInput {
  id: string;
  setId: number;
  mode: Mode;
  esl: boolean;
  seed: number;
  now: number;
  sets: SetsFile;
  questions: Map<number, Question>;
  metas: Map<number, QuestionMeta>;
}

export function examDurationMs(esl: boolean): number {
  return (EXAM_MINUTES + (esl ? ESL_EXTRA_MINUTES : 0)) * 60_000;
}

function metaOf(metas: Map<number, QuestionMeta>, id: number): QuestionMeta {
  const m = metas.get(id);
  if (!m) throw new Error(`Thiếu meta cho câu ${id}`);
  return m;
}

/**
 * Ruling R11: khi chọn ứng viên dự phòng cho vị trí `pos`, bỏ qua bất kỳ ứng viên nào
 * có "twin" (câu trùng lặp verbatim, theo `duplicates`) đang có mặt trong `result` ở
 * một vị trí khác với `pos` — tránh việc một lượt thi chứa cả hai câu trùng nhau.
 */
function twinOf(duplicates: [number, number][], id: number): number | undefined {
  for (const [a, b] of duplicates) {
    if (a === id) return b;
    if (b === id) return a;
  }
  return undefined;
}

export function pickQuestionIds(
  setIds: number[],
  reserve: number[],
  metas: Map<number, QuestionMeta>,
  rng: Rng,
  duplicates: [number, number][] = [],
): number[] {
  const result = setIds.slice();
  const pool = reserve.slice();
  const positions = shuffle(
    result.map((_, i) => i),
    rng,
  ).slice(0, SWAP_COUNT);
  for (const pos of positions) {
    const current = metaOf(metas, result[pos]);
    const notTwinConflict = (id: number) => {
      const twin = twinOf(duplicates, id);
      if (twin === undefined) return true;
      const twinIndex = result.indexOf(twin);
      return twinIndex === -1 || twinIndex === pos;
    };
    // Chỉ thay bằng câu cùng domain và cùng độ khó; không có thì giữ nguyên để đề giữ đúng mức khó.
    const candidates = pool.filter(notTwinConflict).filter((id) => {
      const m = metaOf(metas, id);
      return m.domain === current.domain && m.difficulty === current.difficulty;
    });
    if (candidates.length === 0) continue;
    const chosen = candidates[Math.floor(rng() * candidates.length)];
    result[pos] = chosen;
    pool.splice(pool.indexOf(chosen), 1);
  }
  return result;
}

export function createAttempt(input: CreateAttemptInput): Attempt {
  const rng = mulberry32(input.seed);
  const set = input.sets.sets.find((s) => s.id === input.setId);
  if (!set) throw new Error(`Không có đề ${input.setId}`);
  const ids = shuffle(
    pickQuestionIds(set.questionIds, input.sets.reserve, input.metas, rng, input.sets.duplicates ?? []),
    rng,
  );
  const questions = ids.map((qid) => {
    const q = input.questions.get(qid);
    if (!q) throw new Error(`Không có câu ${qid}`);
    return {
      qid,
      domain: metaOf(input.metas, qid).domain,
      optionOrder: shuffle(
        q.options.map((o) => o.key),
        rng,
      ),
    };
  });
  const real = input.mode === 'real';
  return {
    id: input.id,
    setId: input.setId,
    mode: input.mode,
    seed: input.seed,
    esl: real ? input.esl : false,
    startedAt: input.now,
    endsAt: real ? input.now + examDurationMs(input.esl) : undefined,
    questions,
    answers: {},
    flagged: [],
    guideOpened: [],
    status: 'in-progress',
  };
}

export function displayLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export function isCompatible(attempt: Attempt, questions: Map<number, Question>): boolean {
  if (attempt.status === 'incompatible') return false;
  return attempt.questions.every((aq) => {
    const q = questions.get(aq.qid);
    if (!q) return false;
    const keys = q.options.map((o) => o.key).sort().join(',');
    return [...aq.optionOrder].sort().join(',') === keys;
  });
}
