import { describe, expect, it } from 'vitest';
import { FOLLOWUP_LEN, pickFollowups, splitFollowups, visibleReply } from './followups';

describe('splitFollowups', () => {
  it('tách câu trả lời và tối đa 3 gợi ý, bỏ gạch đầu dòng và dòng trống', () => {
    expect(splitFollowups('Trả lời.\n<<GOI_Y>>\n- Câu 1?\n- Câu 2?\n\n- Câu 3?\n- Câu 4?')).toEqual({
      text: 'Trả lời.',
      suggestions: ['Câu 1?', 'Câu 2?', 'Câu 3?'],
    });
  });

  it('đánh số hay dấu * cũng bỏ; cắt ở 100 ký tự', () => {
    const r = splitFollowups(`A\n<<GOI_Y>>\n1. Một?\n* Hai?\n- ${'x'.repeat(150)}`);
    expect(r.suggestions.slice(0, 2)).toEqual(['Một?', 'Hai?']);
    expect(r.suggestions[2]).toHaveLength(FOLLOWUP_LEN);
  });

  it('không có dấu tách → nguyên văn, không gợi ý', () => {
    expect(splitFollowups('Chỉ trả lời')).toEqual({ text: 'Chỉ trả lời', suggestions: [] });
  });
});

describe('visibleReply', () => {
  it('đuôi là phần đầu dở của dấu tách thì ẩn đuôi đó', () => {
    expect(visibleReply('Abc\n<<GO')).toBe('Abc\n');
    expect(visibleReply('Abc <')).toBe('Abc ');
  });

  it('đã có dấu tách thì ẩn từ dấu trở đi', () => {
    expect(visibleReply('Abc <<GOI_Y>>\n- x')).toBe('Abc ');
  });

  it('chữ thường không bị cắt', () => {
    expect(visibleReply('a < b')).toBe('a < b');
    expect(visibleReply('')).toBe('');
  });
});

describe('pickFollowups', () => {
  it('bỏ câu giống gợi ý cố định, câu đã hỏi và câu trùng nhau', () => {
    expect(
      pickFollowups(
        ['Dịch đề và các lựa chọn sang tiếng Việt.', 'S3 Glacier khác gì?', 'S3 Glacier khác gì?', 'Vì sao cần Multi-AZ?'],
        ['Dịch đề và các lựa chọn sang tiếng Việt'],
        ['vì sao cần multi-az'],
      ),
    ).toEqual(['S3 Glacier khác gì?']);
  });
});
