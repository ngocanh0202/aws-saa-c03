import type { ExternalSet, MainSet, Question, QuestionMeta, QuestionVi, ServiceNote, ServiceRef, SetsFile } from './types';

/** Bộ câu hỏi External kèm hướng dẫn tiếng Việt (theo id câu trong bộ). */
export interface ExternalBook extends ExternalSet {
  vi: Map<number, QuestionVi>;
}

export interface Bank {
  questions: Map<number, Question>;
  meta: Map<number, QuestionMeta>;
  vi: Map<number, QuestionVi>;
  services: Map<string, ServiceRef>;
  serviceNotes: Map<string, ServiceNote>;
  questionsByService: Map<string, number[]>;
  sets: SetsFile;
  /** 12 đề cố định của bộ main (id 101…112); câu và meta đã gộp vào questions/meta. */
  mainSets: MainSet[];
  /** Đề main trùng hoàn toàn với đề khác (ptX_2 = ptX_1 xáo lại): ẩn khỏi trang chủ. */
  hiddenMainSets: Set<number>;
  externals: ExternalBook[];
  /** Id gốc của câu: câu trùng trỏ về bản gốc; câu không trùng trả về chính nó. */
  canonical: (qid: number) => number;
}

export function buildBank(input: {
  questions: Question[];
  metas: QuestionMeta[];
  vis: QuestionVi[];
  registry: ServiceRef[];
  serviceNotes?: ServiceNote[];
  sets: SetsFile;
  mainSets?: MainSet[];
  hiddenMainSets?: Set<number>;
  externals?: ExternalSet[];
  externalVis?: Record<string, QuestionVi[]>;
  /** Cặp câu trùng main, thứ tự [câu gốc, câu trùng] (`twins` trong data/main.json). */
  twins?: [number, number][];
  /** Cặp câu trùng sub, không thứ tự (`duplicates` trong data/sets.json); id nhỏ hơn là gốc. */
  duplicates?: [number, number][];
}): Bank {
  const canonicalOf = new Map<number, number>();
  for (const [orig, twin] of input.twins ?? []) canonicalOf.set(twin, orig);
  for (const [a, b] of input.duplicates ?? []) canonicalOf.set(Math.max(a, b), Math.min(a, b));
  const questionsByService = new Map<string, number[]>();
  for (const m of [...input.metas].sort((a, b) => a.id - b.id)) {
    for (const s of m.services) questionsByService.set(s, [...(questionsByService.get(s) ?? []), m.id]);
  }
  return {
    questions: new Map(input.questions.map((q) => [q.id, q])),
    meta: new Map(input.metas.map((m) => [m.id, m])),
    vi: new Map(input.vis.map((v) => [v.id, v])),
    services: new Map(input.registry.map((s) => [s.id, s])),
    serviceNotes: new Map((input.serviceNotes ?? []).map((s) => [s.id, s])),
    questionsByService,
    sets: input.sets,
    mainSets: input.mainSets ?? [],
    hiddenMainSets: input.hiddenMainSets ?? new Set(),
    externals: (input.externals ?? []).map((set) => ({
      ...set,
      vi: new Map((input.externalVis?.[set.slug] ?? []).map((v) => [v.id, v])),
    })),
    canonical: (qid) => canonicalOf.get(qid) ?? qid,
  };
}
