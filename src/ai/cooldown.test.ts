import { describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/fixtures';
import { COOLDOWN_KEY, createCooldown } from './cooldown';

describe('createCooldown', () => {
  it('đặt giờ hết khóa, hết giờ thì coi như không khóa', () => {
    let t = 1000;
    const c = createCooldown(null, () => t);
    expect(c.until()).toBeNull();
    c.set(5000);
    expect(c.until()).toBe(5000);
    t = 5000;
    expect(c.until()).toBeNull();
  });

  it('giữ giờ muộn hơn khi đặt nhiều lần', () => {
    const c = createCooldown(null, () => 0);
    c.set(9000);
    c.set(3000);
    expect(c.until()).toBe(9000);
  });

  it('lưu vào storage để tải lại trang vẫn còn', () => {
    const storage = memoryStorage();
    createCooldown(storage, () => 0).set(7000);
    expect(storage.getItem(COOLDOWN_KEY)).toBe('7000');
    expect(createCooldown(storage, () => 0).until()).toBe(7000);
  });

  it('báo người nghe khi đổi', () => {
    const c = createCooldown(null, () => 0);
    const l = vi.fn();
    const off = c.subscribe(l);
    c.set(100);
    off();
    c.set(200);
    expect(l).toHaveBeenCalledTimes(1);
  });

  it('storage hỏng hay bị chặn thì vẫn chạy', () => {
    const broken = { getItem: () => 'abc', setItem: () => { throw new Error('quota'); } } as unknown as Storage;
    const c = createCooldown(broken, () => 0);
    expect(c.until()).toBeNull();
    c.set(500);
    expect(c.until()).toBe(500);
  });
});
