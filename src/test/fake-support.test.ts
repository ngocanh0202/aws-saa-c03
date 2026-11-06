import { describe, expect, it } from 'vitest';
import { lastText, type SupportMessage, type SupportThread } from '../support/model';
import { fakeSupport } from './fake-support';

const long = 'x'.repeat(120);

describe('fakeSupport', () => {
  it('user gửi: listenThread nhận tin, inbox có thread chưa đọc phía admin', async () => {
    const s = fakeSupport();
    let msgs: SupportMessage[] = [];
    let inbox: SupportThread[] = [];
    let own: SupportThread | null = null;
    s.listenThread('u1', (m) => (msgs = m), () => {});
    s.listenInbox((t) => (inbox = t), () => {});
    s.listenOwnIndex('u1', (t) => (own = t));
    await s.send('u1', { from: 'user', text: long }, { name: 'An', email: 'an@x.com' });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ from: 'user', text: long });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ uid: 'u1', name: 'An', email: 'an@x.com', lastFrom: 'user', unreadByAdmin: true, last: lastText(long) });
    expect(own).toEqual(inbox[0]);
    expect(s.sent).toEqual([{ uid: 'u1', msg: { from: 'user', text: long } }]);
  });

  it('admin trả lời: unreadByUser true, giữ name/email', async () => {
    const s = fakeSupport();
    let inbox: SupportThread[] = [];
    let msgs: SupportMessage[] = [];
    s.listenInbox((t) => (inbox = t), () => {});
    s.listenThread('u1', (m) => (msgs = m), () => {});
    await s.send('u1', { from: 'user', text: 'hi' }, { name: 'An', email: 'an@x.com' });
    await s.send('u1', { from: 'admin', text: 'chào' }, { name: 'Admin', email: 'admin@x.com' });
    expect(inbox[0]).toMatchObject({ name: 'An', email: 'an@x.com', lastFrom: 'admin', last: 'chào', unreadByUser: true, unreadByAdmin: true });
    expect(msgs.map((m) => m.text)).toEqual(['hi', 'chào']);
    expect(msgs[0].at).toBeLessThan(msgs[1].at);
  });

  it('inbox xếp mới nhất trước; markRead chỉ tắt cờ của người đọc', async () => {
    const s = fakeSupport();
    let inbox: SupportThread[] = [];
    s.listenInbox((t) => (inbox = t), () => {});
    await s.send('u1', { from: 'user', text: 'a' }, { name: 'A' });
    await s.send('u2', { from: 'user', text: 'b' }, { name: 'B' });
    expect(inbox.map((t) => t.uid)).toEqual(['u2', 'u1']);
    await s.markRead('u1', 'admin');
    expect(inbox.find((t) => t.uid === 'u1')).toMatchObject({ unreadByAdmin: false });
  });

  it('markRead khi chưa có thread thì không tạo thread', async () => {
    const s = fakeSupport();
    let inbox: SupportThread[] = [];
    let own: SupportThread | null | undefined;
    s.listenInbox((t) => (inbox = t), () => {});
    s.listenOwnIndex('u9', (t) => (own = t));
    await s.markRead('u9', 'admin');
    await s.markRead('u9', 'user');
    expect(inbox).toEqual([]);
    expect(own).toBeNull();
  });

  it('sendError: send reject và không ghi gì', async () => {
    const s = fakeSupport();
    let msgs: SupportMessage[] = [];
    s.listenThread('u1', (m) => (msgs = m), () => {});
    s.sendError = new Error('offline');
    await expect(s.send('u1', { from: 'user', text: 'hi' }, { name: 'A' })).rejects.toThrow('offline');
    expect(msgs).toEqual([]);
    expect(s.sent).toEqual([]);
    // Chỉ lần kế tiếp bị lỗi.
    await s.send('u1', { from: 'user', text: 'hi' }, { name: 'A' });
    expect(msgs).toHaveLength(1);
  });

  it('huỷ listener thì không nhận nữa', async () => {
    const s = fakeSupport();
    let n = 0;
    const off = s.listenThread('u1', () => n++, () => {});
    off();
    await s.send('u1', { from: 'user', text: 'hi' }, { name: 'A' });
    expect(n).toBe(1);
  });
});
