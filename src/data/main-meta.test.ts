import { expandMainMetas } from './main-meta';

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
