import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Chạy bằng `npm run test:rules` (emulator Realtime Database, cần Java).
const ADMIN_EMAIL = 'buihngocanh2@gmail.com';
/** Giống serverTimestamp() của SDK. */
const TS = { '.sv': 'timestamp' };
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-saa',
    database: { rules: readFileSync('database.rules.json', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearDatabase());

const user = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@x.com`, email_verified: true });
const admin = (verified = true) => env.authenticatedContext('admin', { email: ADMIN_EMAIL, email_verified: verified });
const db = (ctx: RulesTestContext) => ctx.database();

type Opts = { at?: unknown; updatedAt?: unknown; msg?: Record<string, unknown>; extra?: Record<string, unknown> };

/** Gửi tin giống adapter: một update nhiều đường dẫn ở gốc, at/updatedAt = thời gian server. */
function send(ctx: RulesTestContext, uid: string, id: string, from: 'user' | 'admin', o: Opts = {}) {
  const idx = `supportIndex/${uid}`;
  const paths: Record<string, unknown> = {
    [`support/${uid}/messages/${id}`]: { from, text: 'hello', at: o.at ?? TS, ...o.msg },
    [`${idx}/updatedAt`]: o.updatedAt ?? o.at ?? TS,
    [`${idx}/last`]: 'hello',
    [`${idx}/lastFrom`]: from,
    ...(from === 'user' ? { [`${idx}/name`]: uid, [`${idx}/email`]: `${uid}@x.com`, [`${idx}/unreadByAdmin`]: true } : { [`${idx}/unreadByUser`]: true }),
    ...o.extra,
  };
  return db(ctx).ref().update(paths);
}

/** Dữ liệu có sẵn, ghi khi tắt rules. */
async function seed(path: string, value: unknown) {
  await env.withSecurityRulesDisabled((ctx) => ctx.database().ref(path).set(value));
}

/** Bản ghi supportIndex/{uid} có sẵn với updatedAt cho trước. */
const seedIndex = (uid: string, updatedAt: number) =>
  seed(`supportIndex/${uid}`, { name: uid, updatedAt, last: 'x', lastFrom: 'user', unreadByAdmin: true, unreadByUser: false });

describe('support rules: bắt buộc từ chối', () => {
  it('A đọc/ghi support/B bị từ chối', async () => {
    await seed('support/B/messages/m1', { from: 'user', text: 'hi', at: 1 });
    await assertFails(db(user('A')).ref('support/B').once('value'));
    await assertFails(send(user('A'), 'B', 'm2', 'user'));
  });

  it('người thường đọc supportIndex bị từ chối', async () => {
    await assertFails(db(user('A')).ref('supportIndex').once('value'));
  });

  it('email admin chưa xác minh đọc supportIndex bị từ chối', async () => {
    await assertFails(db(admin(false)).ref('supportIndex').once('value'));
  });

  it('người học ghi tin from admin bị từ chối', async () => {
    await assertFails(send(user('A'), 'A', 'm1', 'admin'));
    await assertFails(db(user('A')).ref('support/A/messages/m1').set({ from: 'admin', text: 'x', at: TS }));
  });

  it('ghi đè tin đã có bị từ chối', async () => {
    await seed('support/A/messages/m1', { from: 'user', text: 'hi', at: 1 });
    await assertFails(send(user('A'), 'A', 'm1', 'user', { msg: { text: 'sửa' } }));
    await assertFails(db(user('A')).ref('support/A/messages/m1').remove());
    await assertFails(db(admin()).ref('support/A/messages/m1').set({ from: 'admin', text: 'sửa', at: Date.now() }));
  });

  it('admin đọc users/B/attempts bị từ chối', async () => {
    await seed('users/B/attempts/a1', { json: '{}', updatedAt: 1 });
    await assertFails(db(admin()).ref('users/B/attempts').once('value'));
  });
});

describe('support rules: các ca khác', () => {
  it('người học gửi tin vào cuộc trò chuyện của mình', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user'));
  });

  it('tin kèm báo lỗi hợp lệ; trường lạ, text quá dài bị từ chối', async () => {
    const error = { message: 'boom', code: 'E1', page: '#/exam/x', at: 1 };
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user', { msg: { text: '', error } }));
    await seedIndex('A', Date.now() - 10000);
    await assertFails(send(user('A'), 'A', 'm2', 'user', { msg: { extra: 1 } }));
    await assertFails(send(user('A'), 'A', 'm3', 'user', { msg: { text: 'x'.repeat(4001) } }));
  });

  it('text rỗng mà không có error bị từ chối', async () => {
    await assertFails(send(user('A'), 'A', 'm1', 'user', { msg: { text: '' } }));
  });

  it('ghi tin thẳng mà không cập nhật supportIndex bị từ chối', async () => {
    await assertFails(db(user('A')).ref('support/A/messages/m1').set({ from: 'user', text: 'x', at: TS }));
    await assertFails(db(user('A')).ref('support/A/messages/m1').set({ from: 'user', text: 'x', at: Date.now() }));
  });

  it('admin trả lời và đọc được cuộc trò chuyện', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user'));
    await assertSucceeds(send(admin(), 'A', 'm2', 'admin'));
    await assertSucceeds(send(admin(), 'A', 'm3', 'admin'));
    await assertSucceeds(db(admin()).ref('support/A').once('value'));
  });

  it('người học đọc cuộc trò chuyện và supportIndex của mình', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user'));
    await assertSucceeds(db(user('A')).ref('support/A').once('value'));
    await assertSucceeds(db(user('A')).ref('supportIndex/A').once('value'));
  });

  it('admin đọc supportIndex (theo updatedAt)', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user'));
    await assertSucceeds(db(admin()).ref('supportIndex').orderByChild('updatedAt').once('value'));
  });

  it('chống spam: gửi lần hai ngay lập tức bị từ chối, sau 3 giây thì được', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user'));
    await assertFails(send(user('A'), 'A', 'm2', 'user'));
    await seedIndex('A', Date.now() - 3500);
    await assertSucceeds(send(user('A'), 'A', 'm3', 'user'));
  });

  it('admin không bị giới hạn tần suất', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user'));
    await assertSucceeds(send(admin(), 'A', 'm2', 'admin'));
    await assertSucceeds(send(admin(), 'A', 'm3', 'admin'));
  });

  it('xóa supportIndex rồi gửi lại bị từ chối', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user'));
    await assertFails(db(user('A')).ref('supportIndex/A').remove());
    await assertFails(db(user('A')).ref('supportIndex/A/updatedAt').remove());
    await assertFails(send(user('A'), 'A', 'm2', 'user'));
  });

  it('updatedAt do client chọn (tương lai, cách 3 giây) bị từ chối', async () => {
    const t = Date.now();
    await assertFails(send(user('A'), 'A', 'm1', 'user', { at: t + 3000 }));
    await assertFails(send(user('A'), 'A', 'm2', 'user', { at: t - 5 }));
    await assertFails(send(user('A'), 'A', 'm3', 'user', { at: Date.now() + 120000 }));
  });

  it('người học không giả email người khác', async () => {
    await assertFails(send(user('A'), 'A', 'm1', 'user', { extra: { 'supportIndex/A/email': 'khac@x.com' } }));
  });

  it('đánh dấu đã đọc bằng đường dẫn con', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user'));
    await assertSucceeds(db(admin()).ref('supportIndex/A/unreadByAdmin').set(false));
    await assertSucceeds(db(user('A')).ref('supportIndex/A/unreadByUser').set(false));
    await assertFails(db(user('B')).ref('supportIndex/A/unreadByUser').set(false));
    await assertFails(db(user('A')).ref('supportIndex/A/unreadByUser').set('no'));
  });
});
