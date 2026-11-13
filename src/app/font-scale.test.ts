import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../test/fixtures';
import { FONT_SCALES, FONT_SCALE_KEY, applyFontScale, loadFontScale, saveFontScale, stepFontScale } from './font-scale';

describe('font-scale', () => {
  it('các mức từ 85% tới 130%, mặc định 100%', () => {
    expect(FONT_SCALES[0]).toBe(0.85);
    expect(FONT_SCALES[FONT_SCALES.length - 1]).toBe(1.3);
    expect(loadFontScale(memoryStorage())).toBe(1);
  });

  it('lưu và đọc lại; giá trị hỏng hoặc không có trong danh sách thì về 100%', () => {
    const s = memoryStorage();
    saveFontScale(s, 1.2);
    expect(s.getItem(FONT_SCALE_KEY)).toBe('1.2');
    expect(loadFontScale(s)).toBe(1.2);
    s.setItem(FONT_SCALE_KEY, 'abc');
    expect(loadFontScale(s)).toBe(1);
    s.setItem(FONT_SCALE_KEY, '7');
    expect(loadFontScale(s)).toBe(1);
    expect(loadFontScale(null)).toBe(1);
  });

  it('tăng/giảm theo mức, dừng ở hai đầu', () => {
    expect(stepFontScale(1, 1)).toBe(1.1);
    expect(stepFontScale(1, -1)).toBe(0.9);
    expect(stepFontScale(1.3, 1)).toBe(1.3);
    expect(stepFontScale(0.85, -1)).toBe(0.85);
  });

  it('áp dụng bằng biến --font-scale trên :root (CSS chỉ dùng ở điện thoại)', () => {
    applyFontScale(1.2);
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.2');
    applyFontScale(1);
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('');
  });
});
