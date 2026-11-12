import { describe, expect, it } from 'vitest';
import { parseChatJson } from './chat-json';

describe('parseChatJson', () => {
  it('giữ suggestions hợp lệ', () => {
    const msgs = [
      { role: 'user', text: 'Hỏi' },
      { role: 'model', text: 'Đáp', suggestions: ['Tiếp?'] },
    ];
    expect(parseChatJson(JSON.stringify(msgs))).toEqual(msgs);
  });

  it('suggestions sai kiểu: vẫn tải cuộc chat, bỏ trường đó', () => {
    const json = JSON.stringify([{ role: 'user', text: 'Hỏi' }, { role: 'model', text: 'Đáp', suggestions: 5 }]);
    expect(parseChatJson(json)).toEqual([{ role: 'user', text: 'Hỏi' }, { role: 'model', text: 'Đáp' }]);
  });

  it('hỏng hay sai dạng thì rỗng', () => {
    expect(parseChatJson('{')).toEqual([]);
    expect(parseChatJson(undefined)).toEqual([]);
    expect(parseChatJson(JSON.stringify([{ role: 'x', text: 'a' }]))).toEqual([]);
  });
});
