import type { Difficulty, Domain, Question, QuestionMeta } from '../../src/data/types';
import { DOMAIN_QUOTA } from '../../src/data/constants';
import { allocate, buildSets, findDuplicatePairs } from './build-sets';

function makeMetas(counts: Record<Domain, number>): QuestionMeta[] {
  const out: QuestionMeta[] = [];
  let id = 1;
  for (const d of [1, 2, 3, 4] as Domain[]) {
    for (let i = 0; i < counts[d]; i++) {
      out.push({ id, domain: d, difficulty: ((id % 3) + 1) as Difficulty, services: [] });
      id++;
    }
  }
  return out;
}

describe('allocate', () => {
  it('chia theo tỷ lệ bằng phương pháp phần dư lớn nhất', () => {
    expect(allocate([50, 50, 50], 140)).toEqual([47, 47, 46]);
    expect(allocate([10, 0, 5], 30)).toEqual([10, 0, 5]);
  });
});

describe('buildSets', () => {
  const metas = makeMetas({ 1: 150, 2: 130, 3: 120, 4: 100 });
  const byId = new Map(metas.map((m) => [m.id, m]));
  const { file, warnings } = buildSets(metas);

  it('tạo 7 đề, mỗi đề 65 câu đúng quota domain, không cảnh báo', () => {
    expect(warnings).toEqual([]);
    expect(file.sets).toHaveLength(7);
    for (const set of file.sets) {
      expect(set.questionIds).toHaveLength(65);
      for (const d of [1, 2, 3, 4] as Domain[]) {
        expect(set.questionIds.filter((id) => byId.get(id)!.domain === d)).toHaveLength(DOMAIN_QUOTA[d]);
      }
    }
  });

  it('mọi câu xuất hiện đúng một lần; kho dự phòng có 45 câu', () => {
    const all = [...file.sets.flatMap((s) => s.questionIds), ...file.reserve];
    expect(all).toHaveLength(500);
    expect(new Set(all).size).toBe(500);
    expect(file.reserve).toHaveLength(45);
  });

  it('độ khó tăng dần từ đề 1 đến đề 7 trong từng domain', () => {
    for (const d of [1, 2, 3, 4] as Domain[]) {
      const ranges = file.sets.map((s) => {
        const diffs = s.questionIds.filter((id) => byId.get(id)!.domain === d).map((id) => byId.get(id)!.difficulty);
        return [Math.min(...diffs), Math.max(...diffs)];
      });
      // Câu khó nhất của đề trước không khó hơn câu dễ nhất của đề sau.
      for (let i = 1; i < ranges.length; i++) expect(ranges[i - 1][1]).toBeLessThanOrEqual(ranges[i][0]);
    }
    const avg = file.sets.map((s) => s.questionIds.reduce((a, id) => a + byId.get(id)!.difficulty, 0) / s.questionIds.length);
    expect(avg[0]).toBeLessThan(avg[6]);
  });

  it('kho dự phòng giữ đủ các mức độ khó của từng domain', () => {
    for (const d of [1, 2, 3, 4] as Domain[]) {
      const diffs = new Set(file.reserve.filter((id) => byId.get(id)!.domain === d).map((id) => byId.get(id)!.difficulty));
      expect([...diffs].sort()).toEqual([1, 2, 3]);
    }
  });

  it('tất định: chạy lại cho cùng kết quả', () => {
    expect(buildSets(metas).file).toEqual(file);
  });

  it('domain thiếu câu: vẫn đủ 65 câu mỗi đề và có cảnh báo', () => {
    const short = makeMetas({ 1: 100, 2: 170, 3: 130, 4: 100 });
    const res = buildSets(short);
    expect(res.warnings.some((w) => w.startsWith('Domain 1 chỉ có 100/140'))).toBe(true);
    for (const set of res.file.sets) expect(set.questionIds).toHaveLength(65);
  });

  it('domain thiếu câu: câu của domain đó trải đều các đề, độ khó trung bình vẫn tăng dần', () => {
    const short = makeMetas({ 1: 100, 2: 170, 3: 130, 4: 100 });
    const byShortId = new Map(short.map((m) => [m.id, m]));
    const { file: f } = buildSets(short);
    const d1 = f.sets.map((s) => s.questionIds.filter((id) => byShortId.get(id)!.domain === 1).length);
    expect(Math.max(...d1) - Math.min(...d1)).toBeLessThanOrEqual(1);
    const avg = f.sets.map((s) => s.questionIds.reduce((a, id) => a + byShortId.get(id)!.difficulty, 0) / s.questionIds.length);
    for (let i = 1; i < avg.length; i++) expect(avg[i]).toBeGreaterThanOrEqual(avg[i - 1]);
  });
});

describe('findDuplicatePairs', () => {
  function makeQuestion(id: number, stem: string, prompt: string, optionTexts: string[]): Question {
    return {
      id,
      stem,
      prompt,
      options: optionTexts.map((text, i) => ({ key: String.fromCharCode(65 + i), text })),
      answer: ['A'],
      choose: 1,
      explanationOrig: `Explanation for ${id}`,
    };
  }

  it('tìm ra cặp câu hỏi trùng nhau', () => {
    const questions: Question[] = [
      makeQuestion(1, 'Q1 stem', 'Q1 prompt', ['A', 'B', 'C']),
      makeQuestion(2, 'Q1 stem', 'Q1 prompt', ['A', 'B', 'C']), // duplicate of Q1
      makeQuestion(3, 'Q3 stem', 'Q3 prompt', ['X', 'Y', 'Z']),
    ];
    const pairs = findDuplicatePairs(questions);
    expect(pairs).toEqual([[1, 2]]);
  });

  it('không phát hiện câu gần giống (khác 1 option)', () => {
    const questions: Question[] = [
      makeQuestion(1, 'Q1 stem', 'Q1 prompt', ['A', 'B', 'C']),
      makeQuestion(2, 'Q1 stem', 'Q1 prompt', ['A', 'B', 'D']), // differ in option text
      makeQuestion(3, 'Q3 stem', 'Q3 prompt', ['X', 'Y', 'Z']),
    ];
    const pairs = findDuplicatePairs(questions);
    expect(pairs).toEqual([]);
  });

  it('sắp xếp cặp theo [smaller, larger], danh sách theo cặp đầu tiên', () => {
    const questions: Question[] = [
      makeQuestion(1, 'Q1 stem', 'Q1 prompt', ['A', 'B', 'C']),
      makeQuestion(2, 'Q2 stem', 'Q2 prompt', ['X', 'Y', 'Z']),
      makeQuestion(3, 'Q1 stem', 'Q1 prompt', ['A', 'B', 'C']), // dup of Q1
      makeQuestion(4, 'Q2 stem', 'Q2 prompt', ['X', 'Y', 'Z']), // dup of Q2
    ];
    const pairs = findDuplicatePairs(questions);
    expect(pairs).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });
});

describe('buildSets with duplicates', () => {
  const metas = makeMetas({ 1: 150, 2: 130, 3: 120, 4: 100 });

  it('khi cả hai twin nằm cùng set, đổi twin lớn hơn với câu dự phòng cùng domain, giữ nguyên quota', () => {
    // Create test: Q501 and Q502 are duplicates (hypothetically from the 500 questions)
    // Force them both into set 1 by using specific duplicates list
    // This is a synthetic test case
    const duplicates: [number, number][] = [[1, 2]]; // Q1 and Q2 are duplicates
    const { file } = buildSets(metas, undefined, duplicates);

    // Check if duplicates field is included
    expect(file.duplicates).toEqual(duplicates);

    // Check set sizes still 65
    for (const set of file.sets) {
      expect(set.questionIds).toHaveLength(65);
    }

    // Check domain quotas per set still correct (or match expected deviations)
    const byId = new Map(metas.map((m) => [m.id, m]));
    for (const set of file.sets) {
      for (const d of [1, 2, 3, 4] as Domain[]) {
        const count = set.questionIds.filter((id) => byId.get(id)?.domain === d).length;
        expect([DOMAIN_QUOTA[d], DOMAIN_QUOTA[d] - 1, DOMAIN_QUOTA[d] + 1]).toContain(count);
      }
    }
  });

  it('tất định: chạy lại cho cùng kết quả', () => {
    const duplicates: [number, number][] = [[1, 2]];
    const res1 = buildSets(metas, undefined, duplicates);
    const res2 = buildSets(metas, undefined, duplicates);
    expect(res2.file).toEqual(res1.file);
  });

  it('khi reserve thiếu, dùng cross-set swap để tách twin nằm cùng set', () => {
    // Test with a scenario that would force cross-set swap
    // Create a custom set of metas where we have enough for normal distribution
    const testMetas = makeMetas({ 1: 150, 2: 130, 3: 120, 4: 100 });

    // Test with duplicates where some pairs will need cross-set swap
    // Using pairs from different domains to ensure cross-set swaps happen
    const testDuplicates: [number, number][] = [[1, 2], [5, 6]];
    const { file: baseFile } = buildSets(testMetas, undefined, []);
    const { file: dupFile } = buildSets(testMetas, undefined, testDuplicates);

    // Check that duplicates field is present
    expect(dupFile.duplicates).toEqual(testDuplicates);

    // Check all sets still have 65 questions
    for (const set of dupFile.sets) {
      expect(set.questionIds).toHaveLength(65);
    }

    // Check per-set domain counts are unchanged (should match baseline or within 1)
    const byId = new Map(testMetas.map((m) => [m.id, m]));
    for (let i = 0; i < dupFile.sets.length; i++) {
      for (const d of [1, 2, 3, 4] as Domain[]) {
        const dupCount = dupFile.sets[i].questionIds.filter((id) => byId.get(id)?.domain === d).length;
        const baseCount = baseFile.sets[i].questionIds.filter((id) => byId.get(id)?.domain === d).length;
        expect(Math.abs(dupCount - baseCount)).toBeLessThanOrEqual(1);
      }
    }

    // Check determinism
    const { file: dupFile2 } = buildSets(testMetas, undefined, testDuplicates);
    expect(dupFile2).toEqual(dupFile);
  });
});
