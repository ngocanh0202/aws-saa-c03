import { duplicateMainSetIds, expandMainMetas, expandTwins } from './main-meta';

describe('expandMainMetas', () => {
  it('câu trùng dùng lại meta (kể cả note) của câu gốc, đổi id', () => {
    const metas = [{ id: 10101, domain: 2 as const, difficulty: 1 as const, services: ['s3'], note: 'n' }];
    expect(expandMainMetas(metas, [[10101, 10205]])).toEqual([metas[0], { ...metas[0], id: 10205 }]);
  });

  it('không ghi đè meta soạn riêng cho câu trùng, bỏ qua câu gốc chưa có meta', () => {
    const metas = [
      { id: 10101, domain: 2 as const, difficulty: 1 as const, services: [] },
      { id: 10205, domain: 3 as const, difficulty: 1 as const, services: [] },
    ];
    expect(expandMainMetas(metas, [[10101, 10205], [10102, 10206]])).toEqual(metas);
  });
});

describe('expandTwins', () => {
  it('copies a QuestionVi onto its twin id', () => {
    const vi = { id: 10101, stemVi: 'x', promptVi: 'p', options: [], explanationVi: 'e', keyHint: 'k' };
    const out = expandTwins([vi], [[10101, 10201]]);
    expect(out.map((v) => v.id)).toEqual([10101, 10201]);
    expect(out[1].stemVi).toBe('x');
  });

  it('does not overwrite a twin already present', () => {
    const a = { id: 10101, stemVi: 'a', promptVi: '', options: [], explanationVi: '', keyHint: '' };
    const b = { ...a, id: 10201, stemVi: 'b' };
    expect(expandTwins([a, b], [[10101, 10201]])).toEqual([a, b]);
  });
});

describe('duplicateMainSetIds', () => {
  const sets = [
    { id: 101, file: 'pt1_1.json', title: 'Main 1', questionIds: [10101, 10102] },
    { id: 102, file: 'pt1_2.json', title: 'Main 2', questionIds: [10201, 10202] },
    { id: 103, file: 'pt2_1.json', title: 'Main 3', questionIds: [10301, 10302] },
  ];

  it('chỉ trả đề có mọi câu là câu trùng của đề khác', () => {
    expect(duplicateMainSetIds(sets, [[10101, 10202], [10102, 10201], [10101, 10301]])).toEqual(new Set([102]));
  });

  it('không có twins thì không ẩn đề nào', () => {
    expect(duplicateMainSetIds(sets, [])).toEqual(new Set());
  });
});
