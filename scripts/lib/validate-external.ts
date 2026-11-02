import type { ExternalSet, QuestionVi } from '../../src/data/types';
import { parseExternalHtml } from './parse-external';
import { validateVi, type ViReport } from './validate-vi';

export interface ExternalInput {
  /** Tên file → nội dung các file HTML trong external/. */
  html: Record<string, string>;
  sets: ExternalSet[];
  vis: Record<string, QuestionVi[]>;
}

export function validateExternal(input: ExternalInput): ViReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const setByFile = new Map(input.sets.map((s) => [s.file, s]));

  for (const [file, html] of Object.entries(input.html)) {
    const set = setByFile.get(file);
    let parsed;
    try {
      parsed = parseExternalHtml(html);
    } catch (e) {
      errors.push(`external/${file}: không đọc được câu hỏi (${(e as Error).message})`);
      continue;
    }
    if (!set || JSON.stringify(set.questions) !== JSON.stringify(parsed))
      errors.push(`external/${file}: data/external chưa khớp file HTML, chạy "npm run external"`);
  }
  for (const set of input.sets) {
    if (!(set.file in input.html)) errors.push(`data/external/${set.slug}.json: không còn file external/${set.file}, chạy "npm run external"`);
    const report = validateVi(set.questions, input.vis[set.slug] ?? []);
    errors.push(...report.errors.map((e) => `${set.slug}: ${e}`));
    warnings.push(...report.warnings.map((w) => `${set.slug}: ${w}`));
  }
  for (const slug of Object.keys(input.vis))
    if (!input.sets.some((s) => s.slug === slug)) errors.push(`data/external-vi/${slug}: không có bộ câu hỏi tương ứng`);
  return { errors, warnings };
}
