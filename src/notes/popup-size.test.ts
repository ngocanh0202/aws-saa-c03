import { describe, expect, it } from 'vitest';
import { clamp, loadPopupSize, parsePopupSize, POPUP_SIZE_KEY, savePopupSize } from './popup-size';

function memStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe('clamp', () => {
  it('giữ trong [min, max]; max < min thì lấy min', () => {
    expect(clamp(5, 10, 20)).toBe(10);
    expect(clamp(25, 10, 20)).toBe(20);
    expect(clamp(15, 10, 20)).toBe(15);
    expect(clamp(15, 10, 5)).toBe(10);
  });
});

describe('parsePopupSize', () => {
  it('đọc cỡ hợp lệ', () => {
    expect(parsePopupSize('{"desktop":{"w":400,"h":300},"mobile":{"h":500}}')).toEqual({ desktop: { w: 400, h: 300 }, mobile: { h: 500 } });
  });
  it('bỏ qua dữ liệu hỏng', () => {
    expect(parsePopupSize(null)).toEqual({});
    expect(parsePopupSize('not json')).toEqual({});
    expect(parsePopupSize('[1,2]')).toEqual({});
    expect(parsePopupSize('null')).toEqual({});
    expect(parsePopupSize('{"desktop":{"w":"a","h":3},"mobile":{"h":-1}}')).toEqual({});
    expect(parsePopupSize('{"desktop":{"w":400},"mobile":{"h":null}}')).toEqual({});
    expect(parsePopupSize('{"desktop":{"w":1e999,"h":300}}')).toEqual({});
  });
});

describe('loadPopupSize / savePopupSize', () => {
  it('lưu gộp theo loại máy', () => {
    const s = memStorage();
    savePopupSize(s, { desktop: { w: 400, h: 300 } });
    savePopupSize(s, { mobile: { h: 500 } });
    expect(loadPopupSize(s)).toEqual({ desktop: { w: 400, h: 300 }, mobile: { h: 500 } });
    expect(JSON.parse(s.getItem(POPUP_SIZE_KEY)!)).toEqual({ desktop: { w: 400, h: 300 }, mobile: { h: 500 } });
  });
  it('storage hỏng hoặc bị chặn thì không lỗi', () => {
    expect(loadPopupSize(memStorage({ [POPUP_SIZE_KEY]: '{oops' }))).toEqual({});
    const blocked = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(loadPopupSize(blocked)).toEqual({});
    expect(() => savePopupSize(blocked, { mobile: { h: 1 } })).not.toThrow();
    expect(loadPopupSize(null)).toEqual({});
  });
});
