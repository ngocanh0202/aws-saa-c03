import { describe, expect, it } from 'vitest';
import { SIMILAR_THRESHOLD, findCachedReply, similarity } from './similar';
import type { ChatMessage } from './types';

describe('similarity', () => {
  it('bỏ dấu, hoa thường, dấu câu; giống hệt = 1', () => {
    expect(similarity('Amazon MQ là gì?', 'amazon mq la gi')).toBe(1);
  });

  it('khác vài ký tự vẫn trên 85%, khác hẳn thì thấp', () => {
    expect(similarity('Amazon MQ là gì?', 'Amazn MQ là gì')).toBeGreaterThanOrEqual(SIMILAR_THRESHOLD);
    expect(similarity('Amazon MQ là gì?', 'Amazon S3 Glacier dùng khi nào?')).toBeLessThan(SIMILAR_THRESHOLD);
  });
});

describe('findCachedReply', () => {
  const history: ChatMessage[] = [
    { role: 'user', text: 'Dịch đề và các lựa chọn sang tiếng Việt' },
    { role: 'model', text: 'Bản dịch…' },
    { role: 'user', text: 'Amazon MQ là gì?' },
    { role: 'model', text: 'MQ là message broker…' },
  ];

  it('câu giống ≥ 85% một câu đã có trả lời thì trả lại câu trả lời đó', () => {
    expect(findCachedReply(history, 'amazon mq la gi')).toBe('MQ là message broker…');
  });

  it('không giống, hoặc câu giống nhưng chưa có trả lời thì null', () => {
    expect(findCachedReply(history, 'NAT Gateway khác NAT instance thế nào?')).toBeNull();
    expect(findCachedReply([{ role: 'user', text: 'Amazon MQ là gì?' }], 'Amazon MQ là gì?')).toBeNull();
  });

  it('nhiều câu giống thì lấy lần gần nhất', () => {
    const twice: ChatMessage[] = [...history, { role: 'user', text: 'Amazon MQ là gì?' }, { role: 'model', text: 'Lần sau' }];
    expect(findCachedReply(twice, 'Amazon MQ là gì?')).toBe('Lần sau');
  });
});
