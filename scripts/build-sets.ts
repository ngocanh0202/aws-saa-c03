import { DOMAINS } from '../src/data/constants';
import type { Question, QuestionMeta } from '../src/data/types';
import { buildSets, findDuplicatePairs } from './lib/build-sets';
import { readJson, readJsonDir, writeJson } from './lib/io';

const questions = readJson<Question[]>('data/questions.json');
const metas = readJsonDir<QuestionMeta>('data/meta');
const metaIds = new Set(metas.map((m) => m.id));
const missing = questions.filter((q) => !metaIds.has(q.id)).map((q) => q.id);
if (missing.length > 0) {
  console.error(`LỖI: ${missing.length} câu chưa có meta (ví dụ: ${missing.slice(0, 10).join(', ')}). Hoàn thành data/meta trước.`);
  process.exit(1);
}

const duplicates = findDuplicatePairs(questions);
if (duplicates.length > 0) {
  console.log(`Phát hiện ${duplicates.length} cặp câu trùng nhau: ${duplicates.map((p) => `[${p[0]}, ${p[1]}]`).join(', ')}`);
}

const { file, warnings } = buildSets(metas, undefined, duplicates);
writeJson('data/sets.json', file);
const byId = new Map(metas.map((m) => [m.id, m]));
for (const set of file.sets) {
  const counts = DOMAINS.map((d) => set.questionIds.filter((id) => byId.get(id)!.domain === d).length);
  console.log(`Đề ${set.id}: ${set.questionIds.length} câu, domain 1/2/3/4 = ${counts.join('/')}`);
}
console.log(`Kho dự phòng: ${file.reserve.length} câu`);
for (const w of warnings) console.warn(`CẢNH BÁO: ${w}`);
