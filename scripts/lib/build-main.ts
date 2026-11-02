import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MainFile } from '../../src/data/types';
import { readJson } from './io';
import { buildMainSet, findMainTwins, sortMainFiles, type MainRawQuestion } from './parse-main';

/** Dựng data/main.json từ thư mục question-doc-main (không sửa file nguồn). */
export function buildMainFromDir(dir: string): MainFile {
  const out: MainFile = { sets: [], questions: [], twins: [] };
  if (!existsSync(dir)) return out;
  sortMainFiles(readdirSync(dir).filter((f) => f.endsWith('.json'))).forEach((file, i) => {
    const { set, questions } = buildMainSet(file, i, readJson<MainRawQuestion[]>(join(dir, file)));
    out.sets.push(set);
    out.questions.push(...questions);
  });
  out.twins = findMainTwins(out.questions);
  return out;
}
