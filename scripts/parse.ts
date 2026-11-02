import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Question } from '../src/data/types';
import { writeJson } from './lib/io';
import { parseDocx } from './lib/parse-docx';
import { parseMarkdown } from './lib/parse-md';

const SOURCE_DIR = 'question-doc-sub';
const OUTPUT = 'data/questions.json';

const questions: Question[] = [];
for (const file of readdirSync(SOURCE_DIR).sort()) {
  const path = join(SOURCE_DIR, file);
  if (file.endsWith('.md')) questions.push(...parseMarkdown(readFileSync(path, 'utf8')));
  else if (file.endsWith('.docx')) questions.push(...parseDocx(new Uint8Array(readFileSync(path))));
}
questions.sort((a, b) => a.id - b.id);
writeJson(OUTPUT, questions);
console.log(`Đã parse ${questions.length} câu → ${OUTPUT}`);
