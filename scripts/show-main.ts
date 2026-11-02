import type { MainFile } from '../src/data/types';
import { readJson } from './lib/io';
import { htmlToText } from './lib/parse-main';

const [file, startArg, endArg] = process.argv.slice(2);
if (!file) {
  console.error('Cách dùng: npm run main:show -- <pt1_1> [vị trí đầu] [vị trí cuối]');
  process.exit(1);
}
const data = readJson<MainFile>('data/main.json');
const set = data.sets.find((s) => s.file === `${file}.json` || s.file === file);
if (!set) {
  console.error(`Không có file ${file} trong data/main.json (chạy npm run main trước)`);
  process.exit(1);
}
const byId = new Map(data.questions.map((q) => [q.id, q]));
const start = Number(startArg ?? 1);
const end = Number(endArg ?? set.questionIds.length);
console.log(`${set.title} (${set.file}) · vị trí ${start}–${end} → data/main-meta/${set.file}\n`);
set.questionIds.slice(start - 1, end).forEach((id, i) => {
  const q = byId.get(id)!;
  console.log(`=== id ${id} (vị trí ${start + i}) · chọn ${q.choose} · đáp án: ${q.answer.join(', ')} ===`);
  console.log(htmlToText(q.stem));
  for (const o of q.options) console.log(`${o.key}. ${htmlToText(o.text)}`);
  console.log(`GIẢI THÍCH GỐC:\n${htmlToText(q.explanationOrig)}\n`);
});
