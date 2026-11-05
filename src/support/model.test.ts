import { describe, expect, it } from 'vitest';
import { lastText, mailtoHref, makeErrorReport } from './model';

describe('makeErrorReport', () => {
  it('cắt message, bỏ code rỗng', () => {
    const r = makeErrorReport({ message: 'x'.repeat(1200), code: '' }, '#/a', 5);
    expect(r.message.length).toBe(1000);
    expect('code' in r).toBe(false);
    expect(r.page).toBe('#/a');
    expect(r.at).toBe(5);
  });
  it('cắt page còn 500', () => {
    expect(makeErrorReport({ message: 'm' }, 'p'.repeat(600), 0).page.length).toBe(500);
  });
});

describe('lastText', () => {
  it('gộp khoảng trắng', () => expect(lastText('  a\n b  ')).toBe('a b'));
  it('cắt dài thêm …', () => {
    const t = lastText('a'.repeat(100));
    expect(t.length).toBe(81);
    expect(t.endsWith('…')).toBe(true);
  });
  it('text rỗng mà có lỗi', () => {
    expect(lastText('', { message: 'Hỏng', page: '#/', at: 0 })).toBe('⚠ Hỏng');
  });
});

describe('mailtoHref', () => {
  it('có đủ thông tin lỗi', () => {
    const href = mailtoHref(
      makeErrorReport({ message: 'Không lưu được', code: 'auth/x' }, '#/exam/1', Date.UTC(2026, 10, 5)),
    );
    expect(href.startsWith('mailto:buihngocanh2@gmail.com?subject=')).toBe(true);
    const body = decodeURIComponent(href.split('&body=')[1]);
    expect(body).toContain('Lỗi: Không lưu được');
    expect(body).toContain('Mã: auth/x');
    expect(body).toContain('Trang: #/exam/1');
    expect(body).toContain('2026-11-05T00:00:00.000Z');
  });
  it('không lỗi vẫn có subject', () => {
    const href = mailtoHref();
    expect(decodeURIComponent(href)).toContain('subject=Lỗi trên web luyện thi SAA-C03');
  });
});
