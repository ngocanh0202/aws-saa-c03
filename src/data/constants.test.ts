import { DOMAINS, DOMAIN_QUOTA, SET_COUNT, SET_SIZE, TOTAL_QUESTIONS, byDomainRecord } from './constants';

describe('constants', () => {
  it('quota cộng lại đúng 65 câu mỗi đề', () => {
    expect(DOMAINS.reduce((s, d) => s + DOMAIN_QUOTA[d], 0)).toBe(SET_SIZE);
  });

  it('7 đề × 65 câu không vượt quá ngân hàng câu hỏi, dư đúng 45', () => {
    expect(TOTAL_QUESTIONS - SET_COUNT * SET_SIZE).toBe(45);
  });

  it('byDomainRecord tạo đủ 4 domain', () => {
    expect(byDomainRecord((d) => d * 10)).toEqual({ 1: 10, 2: 20, 3: 30, 4: 40 });
  });
});
