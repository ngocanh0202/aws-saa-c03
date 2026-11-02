import type { ExternalSet, MainFile, Question, QuestionMeta, QuestionVi, ServiceNote, ServiceRef, SetsFile } from '../src/data/types';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildMainFromDir } from './lib/build-main';
import { listJsonIds, readJson, readJsonDir, readJsonIfExists } from './lib/io';
import { validate } from './lib/validate';
import { validateExternal } from './lib/validate-external';
import { validateMain } from './lib/validate-main';

const noteIds = listJsonIds('data/services');
const report = validate({
  questions: readJson<Question[]>('data/questions.json'),
  metas: readJsonDir<QuestionMeta>('data/meta'),
  vis: readJsonDir<QuestionVi>('data/vi'),
  registry: readJsonIfExists<ServiceRef[]>('data/service-registry.json', []),
  noteIds,
  serviceNotes: noteIds.map((id) => readJson<ServiceNote>(join('data/services', `${id}.json`))),
  sets: readJsonIfExists<SetsFile | null>('data/sets.json', null),
});

const htmlFiles = existsSync('external') ? readdirSync('external').filter((f) => f.endsWith('.html')) : [];
const extVis = existsSync('data/external-vi') ? readdirSync('data/external-vi') : [];
const ext = validateExternal({
  html: Object.fromEntries(htmlFiles.map((f) => [f, readFileSync(join('external', f), 'utf8')])),
  sets: listJsonIds('data/external').map((id) => readJson<ExternalSet>(join('data/external', `${id}.json`))),
  vis: Object.fromEntries(extVis.map((slug) => [slug, readJsonDir<QuestionVi>(join('data/external-vi', slug))])),
});
report.errors.push(...ext.errors);
report.warnings.push(...ext.warnings);

const main = validateMain({
  main: readJsonIfExists<MainFile | null>('data/main.json', null),
  rebuilt: buildMainFromDir('question-doc-main'),
  metas: readJsonDir<QuestionMeta>('data/main-meta'),
  registryIds: new Set(readJsonIfExists<ServiceRef[]>('data/service-registry.json', []).map((s) => s.id)),
});
report.errors.push(...main.errors);
report.warnings.push(...main.warnings);

for (const w of report.warnings) console.warn(`CẢNH BÁO: ${w}`);
for (const e of report.errors) console.error(`LỖI: ${e}`);
console.log(`Kết quả: ${report.errors.length} lỗi, ${report.warnings.length} cảnh báo`);
process.exit(report.errors.length > 0 ? 1 : 0);
