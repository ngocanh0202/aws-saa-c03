import type { MainFile } from '../../src/data/types';
import { validateMain } from './validate-main';

const q = (id: number) => ({ id, stem: '<p>s</p>', prompt: '', options: [{ key: 'A', text: 'a' }], answer: ['A'], choose: 1, explanationOrig: '', html: true });
const main: MainFile = {
  sets: [{ id: 101, file: 'pt1_1.json', title: 'Main 1', questionIds: [10101] }, { id: 102, file: 'pt1_2.json', title: 'Main 2', questionIds: [10201] }],
  questions: [q(10101), q(10201)],
  twins: [[10101, 10201]],
};
const meta = { id: 10101, domain: 1 as const, difficulty: 2 as const, services: ['s3'] };
const run = (overrides: Partial<Parameters<typeof validateMain>[0]> = {}) =>
  validateMain({ main, rebuilt: main, metas: [meta], registryIds: new Set(['s3']), ...overrides });

describe('validateMain', () => {
  it('đủ meta (câu trùng dùng meta câu gốc) thì không lỗi', () => {
    expect(run().errors).toEqual([]);
  });

  it('data/main.json lệch so với question-doc-main thì báo chạy npm run main', () => {
    expect(run({ main: null }).errors[0]).toMatch(/npm run main/);
  });

  it('báo thiếu meta, service lạ và domain sai', () => {
    expect(run({ metas: [] }).errors[0]).toMatch(/thiếu meta cho 2 câu/);
    const errors = run({ metas: [{ ...meta, domain: 5 as never, services: ['nope'] }] }).errors.join('\n');
    expect(errors).toMatch(/domain 5/);
    expect(errors).toMatch(/"nope"/);
  });
});
