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
    expect(findCachedReply(history, 'amazon mq la gi')?.text).toBe('MQ là message broker…');
  });

  it('không giống, hoặc câu giống nhưng chưa có trả lời thì null', () => {
    expect(findCachedReply(history, 'NAT Gateway khác NAT instance thế nào?')).toBeNull();
    expect(findCachedReply([{ role: 'user', text: 'Amazon MQ là gì?' }], 'Amazon MQ là gì?')).toBeNull();
  });

  it('nhiều câu giống thì lấy lần gần nhất', () => {
    const twice: ChatMessage[] = [...history, { role: 'user', text: 'Amazon MQ là gì?' }, { role: 'model', text: 'Lần sau' }];
    expect(findCachedReply(twice, 'Amazon MQ là gì?')?.text).toBe('Lần sau');
  });
});

describe('findCachedReply: trả về cả tin (mang theo gợi ý)', () => {
  it('giữ suggestions của tin gốc', () => {
    const msgs: ChatMessage[] = [
      { role: 'user', text: 'Amazon MQ là gì?' },
      { role: 'model', text: 'Broker', suggestions: ['MQ khác SQS?'] },
    ];
    expect(findCachedReply(msgs, 'Amazon MQ là gì?')?.suggestions).toEqual(['MQ khác SQS?']);
  });
});

describe('findCachedReply: câu trả lời hidden', () => {
  const msgs: ChatMessage[] = [
    { role: 'user', text: 'Đáp án là gì?' },
    { role: 'model', text: 'Bấm Xem hướng dẫn', hidden: true },
  ];
  it('chưa xem đáp án: dùng lại được', () => {
    expect(findCachedReply(msgs, 'Đáp án là gì?', false)?.text).toBe('Bấm Xem hướng dẫn');
  });
  it('đã xem đáp án: bỏ qua câu trả lời hidden', () => {
    expect(findCachedReply(msgs, 'Đáp án là gì?', true)).toBeNull();
  });
  it('câu trả lời cũ không có nhãn vẫn dùng lại được', () => {
    expect(findCachedReply([msgs[0], { role: 'model', text: 'Là B' }], 'Đáp án là gì?', true)?.text).toBe('Là B');
  });
});
