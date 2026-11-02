import { mulberry32, shuffle } from './rng';

describe('mulberry32', () => {
  it('cùng seed cho cùng dãy số, nằm trong [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('shuffle', () => {
  it('là hoán vị, không sửa mảng gốc, tất định theo seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, mulberry32(1));
    expect([...out].sort((x, y) => x - y)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(shuffle(input, mulberry32(1))).toEqual(out);
    expect(shuffle(input, mulberry32(2))).not.toEqual(out);
  });
});
