import type { ExternalSet } from '../src/data/types';
import { readJson } from './lib/io';

const [slug, startArg, endArg] = process.argv.slice(2);
if (!slug) {
  console.error('Cách dùng: npm run external:show -- <slug> [câu đầu] [câu cuối]');
  process.exit(1);
}
const set = readJson<ExternalSet>(`data/external/${slug}.json`);
const start = Number(startArg ?? 1);
const end = Number(endArg ?? set.questions.length);
console.log(`${set.title} (${set.file}) · câu ${start}–${end} → data/external-vi/${slug}/<lô>.json\n`);
for (const q of set.questions.filter((x) => x.id >= start && x.id <= end)) {
  console.log(`=== Câu ${q.id} · chọn ${q.choose} · đáp án: ${q.answer.join(', ')} ===`);
  console.log(`STEM:\n${q.stem}`);
  console.log(`PROMPT: ${q.prompt}`);
  for (const o of q.options) console.log(`${o.key}. ${o.text}`);
  console.log(`GIẢI THÍCH GỐC (tiếng Anh):\n${q.explanationOrig}\n`);
}
