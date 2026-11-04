import { describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/fixtures';
import { AI_MODE_KEY, createAiMode } from './ai-mode';

describe('createAiMode', () => {
  it('mặc định gemini; đổi được và báo người nghe', () => {
    const m = createAiMode(null);
    const l = vi.fn();
    m.subscribe(l);
    expect(m.get()).toBe('gemini');
    m.set('local');
    expect(m.get()).toBe('local');
    expect(l).toHaveBeenCalledTimes(1);
  });

  it('lưu vào storage theo máy; giá trị lạ thì về gemini', () => {
    const s = memoryStorage();
    createAiMode(s).set('local');
    expect(s.getItem(AI_MODE_KEY)).toBe('local');
    expect(createAiMode(s).get()).toBe('local');
    s.setItem(AI_MODE_KEY, 'xyz');
    expect(createAiMode(s).get()).toBe('gemini');
  });
});
