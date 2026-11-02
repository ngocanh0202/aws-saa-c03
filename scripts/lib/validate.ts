import { DOMAINS, DOMAIN_QUOTA, SERVICE_CATEGORIES, SET_COUNT, SET_SIZE, TOTAL_QUESTIONS } from '../../src/data/constants';
import type { Domain, Question, QuestionMeta, QuestionVi, ServiceNote, ServiceRef, SetsFile } from '../../src/data/types';
import { validateVi } from './validate-vi';

export interface ValidationInput {
  questions: Question[];
  metas: QuestionMeta[];
  vis: QuestionVi[];
  registry: ServiceRef[];
  noteIds: string[];
  serviceNotes: ServiceNote[];
  sets: SetsFile | null;
}

export interface ValidationRules {
  total: number;
  setCount: number;
  setSize: number;
  quota: Record<Domain, number>;
}

export const DEFAULT_RULES: ValidationRules = {
  total: TOTAL_QUESTIONS,
  setCount: SET_COUNT,
  setSize: SET_SIZE,
  quota: DOMAIN_QUOTA,
};

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

export function expectedChoose(q: Question): number {
  const text = `${q.stem}\n${q.prompt}`;
  if (/choose three/i.test(text)) return 3;
  if (/choose two/i.test(text)) return 2;
  return 1;
}

export function validate(input: ValidationInput, rules: ValidationRules = DEFAULT_RULES): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(input.questions.map((q) => [q.id, q]));

  // Câu hỏi
  if (input.questions.length !== rules.total) errors.push(`Có ${input.questions.length} câu, cần ${rules.total}`);
  for (let id = 1; id <= rules.total; id++) if (!byId.has(id)) errors.push(`Thiếu câu ${id}`);
  for (const q of input.questions) {
    const keys = new Set(q.options.map((o) => o.key));
    for (const a of q.answer) if (!keys.has(a)) errors.push(`Câu ${q.id}: đáp án ${a} không có trong lựa chọn`);
    const expected = expectedChoose(q);
    if (expected !== q.answer.length)
      errors.push(`Câu ${q.id}: đề yêu cầu chọn ${expected} nhưng đáp án có ${q.answer.length}`);
  }

  // Registry
  const registryIds = new Set<string>();
  for (const s of input.registry) {
    if (registryIds.has(s.id)) errors.push(`registry: service "${s.id}" bị trùng`);
    registryIds.add(s.id);
    if (!(SERVICE_CATEGORIES as readonly string[]).includes(s.category))
      errors.push(`registry: service "${s.id}" có category không hợp lệ (${s.category})`);
  }

  // Service notes
  const noteFiles = new Set(input.noteIds);
  const noteById = new Map<string, ServiceNote>();
  const registryById = new Map(input.registry.map((s) => [s.id, s]));
  for (const note of input.serviceNotes) {
    if (noteById.has(note.id)) errors.push(`services: ghi chú service "${note.id}" bị trùng`);
    noteById.set(note.id, note);
    const ref = registryById.get(note.id);
    if (!ref) errors.push(`services: ghi chú service "${note.id}" không có trong service-registry.json`);
    else if (note.name !== ref.name || note.category !== ref.category)
      errors.push(`services: ghi chú "${note.id}" không khớp name/category trong service-registry.json`);
    if (!noteFiles.has(note.id)) errors.push(`services: thiếu file data/services/${note.id}.json`);
    if (note.tier !== 'core' && note.tier !== 'minor') errors.push(`services: "${note.id}" có tier không hợp lệ`);
    if (!note.overview?.trim()) errors.push(`services: "${note.id}" thiếu overview`);
    if (!note.examSignals?.length || note.examSignals.some((s) => !s.trim()))
      errors.push(`services: "${note.id}" thiếu examSignals`);
    if (!note.compareWith?.length || note.compareWith.some((c) => !c.service.trim() || !c.diff.trim()))
      errors.push(`services: "${note.id}" thiếu compareWith`);
    if (note.tier === 'core') {
      if (!note.concepts?.length || note.concepts.some((c) => !c.term.trim() || !c.desc.trim()))
        errors.push(`services: core "${note.id}" thiếu concepts`);
      if (!note.howItWorks?.trim()) errors.push(`services: core "${note.id}" thiếu howItWorks`);
      if (!note.useCases?.length || note.useCases.some((s) => !s.trim()))
        errors.push(`services: core "${note.id}" thiếu useCases`);
      if (!note.pricing?.trim()) errors.push(`services: core "${note.id}" thiếu pricing`);
      if (!note.facts?.length || note.facts.some((s) => !s.trim())) errors.push(`services: core "${note.id}" thiếu facts`);
      if (!note.practice?.steps?.length || note.practice.steps.some((s) => !s.trim()))
        errors.push(`services: core "${note.id}" thiếu practice.steps`);
      if (!note.practice?.freeTier?.trim()) errors.push(`services: core "${note.id}" thiếu practice.freeTier`);
      if (!note.practice?.cleanup?.length || note.practice.cleanup.some((s) => !s.trim()))
        errors.push(`services: core "${note.id}" thiếu practice.cleanup`);
    }
  }
  for (const id of input.noteIds) {
    if (!noteById.has(id)) errors.push(`services: file data/services/${id}.json không có nội dung JSON hợp lệ`);
  }

  // Meta
  const metaById = new Map<number, QuestionMeta>();
  for (const m of input.metas) {
    if (!byId.has(m.id)) errors.push(`meta: câu ${m.id} không tồn tại`);
    if (metaById.has(m.id)) errors.push(`meta: câu ${m.id} bị trùng`);
    metaById.set(m.id, m);
    if (!DOMAINS.includes(m.domain)) errors.push(`meta: câu ${m.id} có domain không hợp lệ (${m.domain})`);
    if (![1, 2, 3].includes(m.difficulty)) errors.push(`meta: câu ${m.id} có độ khó không hợp lệ (${m.difficulty})`);
    if (m.services.length === 0) warnings.push(`meta: câu ${m.id} chưa gắn service nào`);
    for (const s of m.services)
      if (!registryIds.has(s)) errors.push(`meta: câu ${m.id} dùng service "${s}" không có trong service-registry.json`);
  }
  const missingMeta = input.questions.filter((q) => !metaById.has(q.id)).length;
  if (missingMeta > 0) warnings.push(`${missingMeta} câu chưa có meta`);

  // Ghi chú service (giai đoạn 3)
  const noteIds = new Set(input.noteIds);
  const missingNotes = [...registryIds].filter((id) => !noteIds.has(id)).length;
  if (missingNotes > 0) warnings.push(`${missingNotes} service chưa có ghi chú trong data/services/`);

  // Bản dịch
  const viReport = validateVi(input.questions, input.vis, input.sets?.duplicates ?? []);
  errors.push(...viReport.errors);
  warnings.push(...viReport.warnings);

  // Đề
  if (!input.sets) {
    warnings.push('Chưa có data/sets.json');
  } else {
    const seen = new Set<number>();
    const all = [...input.sets.sets.flatMap((s) => s.questionIds), ...input.sets.reserve];
    for (const id of all) {
      if (seen.has(id)) errors.push(`sets: câu ${id} xuất hiện nhiều lần`);
      seen.add(id);
      if (!byId.has(id)) errors.push(`sets: câu ${id} không tồn tại`);
    }
    if (all.length !== rules.total)
      errors.push(`sets: tổng số câu trong đề và kho dự phòng là ${all.length}, cần ${rules.total}`);
    if (input.sets.sets.length !== rules.setCount)
      errors.push(`sets: có ${input.sets.sets.length} đề, cần ${rules.setCount}`);
    for (const set of input.sets.sets) {
      if (set.questionIds.length !== rules.setSize)
        errors.push(`sets: Đề ${set.id} có ${set.questionIds.length} câu, cần ${rules.setSize}`);
      for (const d of DOMAINS) {
        const count = set.questionIds.filter((id) => metaById.get(id)?.domain === d).length;
        if (count !== rules.quota[d]) warnings.push(`sets: Đề ${set.id} có domain ${d} = ${count} câu (quota ${rules.quota[d]})`);
      }
    }

    // Check for duplicate pairs in same set
    if (input.sets.duplicates) {
      for (const [q1, q2] of input.sets.duplicates) {
        for (const set of input.sets.sets) {
          const has1 = set.questionIds.includes(q1);
          const has2 = set.questionIds.includes(q2);
          if (has1 && has2) {
            errors.push(`sets: câu ${q1} và ${q2} trùng nhau nhưng cùng nằm trong Đề ${set.id}`);
          }
        }
      }
    }
  }

  return { errors, warnings };
}
