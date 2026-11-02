import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { ExternalSet } from '../src/data/types';
import { writeJson } from './lib/io';
import { parseExternalHtml } from './lib/parse-external';

const SRC = 'external';
const OUT = 'data/external';

rmSync(OUT, { recursive: true, force: true });
for (const file of readdirSync(SRC).filter((f) => f.endsWith('.html')).sort()) {
  const html = readFileSync(join(SRC, file), 'utf8');
  const slug = file.slice(0, -'.html'.length);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1].trim() || slug;
  const set: ExternalSet = { slug, file, title, questions: parseExternalHtml(html) };
  writeJson(join(OUT, `${slug}.json`), set);
  console.log(`${file} → ${OUT}/${slug}.json (${set.questions.length} câu)`);
}
