import { describe, expect, it, vi } from 'vitest';
import { claimChatFocus, onChatFocus } from '../components/chat-focus';
import { errorReportHere, onOpenSupport, onRequestSignIn, openSupport, openSupportAfterSignIn, requestSignIn } from './open';

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

  it('openSupportAfterSignIn: khung đăng ký nghe sau (vừa đăng nhập) nhận đúng yêu cầu, chỉ một lần', () => {
    const req = { error: { message: 'm', page: '#/', at: 1 } };
    openSupportAfterSignIn(req);
    const fn = vi.fn();
    const off = onOpenSupport(fn);
    expect(fn).toHaveBeenCalledWith(req);
    off();
    const again = vi.fn();
    onOpenSupport(again)();
    expect(again).not.toHaveBeenCalled();
  });

  it('openSupportAfterSignIn: quá 2 phút chưa đăng nhập thì bỏ', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    openSupportAfterSignIn({});
    now.mockReturnValue(1_000 + 2 * 60_000 + 1);
    const fn = vi.fn();
    onOpenSupport(fn)();
    expect(fn).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it('requestSignIn báo người nghe', () => {
    const fn = vi.fn();
    const off = onRequestSignIn(fn);
    requestSignIn();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    requestSignIn();
    expect(fn).toHaveBeenCalledTimes(1);
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
