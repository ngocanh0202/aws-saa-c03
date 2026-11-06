import { describe, expect, it, vi } from 'vitest';
import { claimChatFocus, onChatFocus } from '../components/chat-focus';
import { errorReportHere, onOpenSupport, openSupport } from './open';

describe('openSupport', () => {
  it('listener nhận đúng req', () => {
    const fn = vi.fn();
    const off = onOpenSupport(fn);
    const req = { error: { message: 'm', page: '#/', at: 1 } };
    openSupport(req);
    expect(fn).toHaveBeenCalledWith(req);
    off();
  });

  it('hủy đăng ký thì không nhận nữa', () => {
    const fn = vi.fn();
    onOpenSupport(fn)();
    openSupport();
    expect(fn).not.toHaveBeenCalled();
  });

  it('errorReportHere dùng trang và giờ hiện tại', () => {
    location.hash = '#/x';
    const r = errorReportHere({ message: 'm', code: 'c' });
    expect(r).toMatchObject({ message: 'm', code: 'c', page: '#/x' });
    expect(typeof r.at).toBe('number');
  });
});

describe('chat focus', () => {
  it('claimChatFocus gọi listener với id', () => {
    const fn = vi.fn();
    const off = onChatFocus(fn);
    claimChatFocus('a');
    expect(fn).toHaveBeenCalledWith('a');
    off();
    claimChatFocus('b');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
