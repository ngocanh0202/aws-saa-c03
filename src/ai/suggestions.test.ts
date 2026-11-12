import { describe, expect, it } from 'vitest';
import { HIGHLIGHT_SUGGESTION, MAX_SERVICE_SUGGESTIONS, chatSuggestions } from './suggestions';

const services = new Map([
  ['mq', { id: 'mq', name: 'Amazon MQ', category: 'App' }],
  ['s3', { id: 's3', name: 'Amazon S3', category: 'Storage' }],
]);

describe('chatSuggestions', () => {
  it('dịch đề, đề hỏi gì, mỗi service một câu "là gì?", cách loại trừ', () => {
    expect(chatSuggestions(['mq', 's3'], services)).toEqual([
      'Dịch đề và các lựa chọn sang tiếng Việt',
      'Đề này đang hỏi gì?',
      'Amazon MQ là gì?',
      'Amazon S3 là gì?',
      'Gợi ý cách loại trừ lựa chọn sai',
    ]);
  });

  it(`tối đa ${MAX_SERVICE_SUGGESTIONS} service; id lạ thì dùng chính id; không có service thì chỉ câu chung`, () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(chatSuggestions(many, services).filter((s) => s.endsWith('là gì?'))).toHaveLength(MAX_SERVICE_SUGGESTIONS);
    expect(chatSuggestions(['x'], services)).toContain('x là gì?');
    expect(chatSuggestions([], services)).toHaveLength(3);
  });

  it('có tool tô thì thêm câu nhờ tô từ khóa, ngay sau "Đề này đang hỏi gì?"', () => {
    expect(chatSuggestions([], services, { highlight: true })[2]).toBe('Tô từ khóa quan trọng trong đề');
    expect(chatSuggestions([], services)).not.toContain(HIGHLIGHT_SUGGESTION);
  });
});
