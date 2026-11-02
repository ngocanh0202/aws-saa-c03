import type { Question, QuestionMeta, SetsFile } from '../src/data/types';
import { BATCH_SIZE, batchRange, formatBatch } from './lib/batch';
import { readJson, readJsonDir, readJsonIfExists } from './lib/io';

const start = Number(process.argv[2]);
if (!Number.isInteger(start) || start < 1 || start > 500 || (start - 1) % BATCH_SIZE !== 0) {
  console.error('Cách dùng: npm run vi:show -- <câu đầu lô: 1, 26, 51, …, 476>');
  process.exit(1);
}
const { end, file } = batchRange(start);
const questions = readJson<Question[]>('data/questions.json');
const metas = readJsonDir<QuestionMeta>('data/meta');
const sets = readJsonIfExists<SetsFile | null>('data/sets.json', null);
console.log(`Lô ${start}–${end} → data/vi/${file}\n`);
console.log(formatBatch(questions, metas, sets?.duplicates ?? [], start, end));
