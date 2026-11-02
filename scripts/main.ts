import { writeJson } from './lib/io';
import { buildMainFromDir } from './lib/build-main';

const OUT = 'data/main.json';

const out = buildMainFromDir('question-doc-main');
for (const set of out.sets) console.log(`${set.file} → ${set.title} (id ${set.id}, câu ${set.questionIds[0]}–${set.questionIds.at(-1)})`);
writeJson(OUT, out);
console.log(`Đã ghi ${OUT}: ${out.sets.length} đề, ${out.questions.length} câu, ${out.twins.length} cặp câu trùng nguyên văn`);
