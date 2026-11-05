import { describe, expect, it } from 'vitest';
import { ADMIN_EMAIL, isAdmin } from './admin';

const u = (email?: string, emailVerified?: boolean) => ({ uid: 'a', name: 'x', email, emailVerified });

describe('isAdmin', () => {
  it('email admin đã xác minh là admin', () => {
    expect(isAdmin(u(ADMIN_EMAIL, true))).toBe(true);
  });
  it('chưa xác minh hoặc thiếu cờ thì không', () => {
    expect(isAdmin(u(ADMIN_EMAIL, false))).toBe(false);
    expect(isAdmin(u(ADMIN_EMAIL))).toBe(false);
  });
  it('không phân biệt hoa thường', () => {
    expect(isAdmin(u('BUIHNGOCANH2@gmail.com', true))).toBe(true);
  });
  it('email khác, null, undefined thì không', () => {
    expect(isAdmin(u('other@gmail.com', true))).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});
