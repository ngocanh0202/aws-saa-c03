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

/** Gửi tin giống adapter: một update nhiều đường dẫn ở gốc. */
function send(ctx: RulesTestContext, uid: string, id: string, from: 'user' | 'admin', at: number, extra: Record<string, unknown> = {}) {
  const idx = `supportIndex/${uid}`;
  const paths: Record<string, unknown> = {
    [`support/${uid}/messages/${id}`]: { from, text: 'hello', at },
    [`${idx}/updatedAt`]: at,
    [`${idx}/last`]: 'hello',
    [`${idx}/lastFrom`]: from,
    ...(from === 'user' ? { [`${idx}/name`]: uid, [`${idx}/email`]: `${uid}@x.com`, [`${idx}/unreadByAdmin`]: true } : { [`${idx}/unreadByUser`]: true }),
    ...extra,
  };
  return db(ctx).ref().update(paths);
}

/** Dữ liệu có sẵn, ghi khi tắt rules. */
async function seed(path: string, value: unknown) {
  await env.withSecurityRulesDisabled((ctx) => ctx.database().ref(path).set(value));
}

describe('support rules: bắt buộc từ chối', () => {
  it('A đọc/ghi support/B bị từ chối', async () => {
    await seed('support/B/messages/m1', { from: 'user', text: 'hi', at: 1 });
    await assertFails(db(user('A')).ref('support/B').once('value'));
    await assertFails(db(user('A')).ref('support/B/messages/m2').set({ from: 'user', text: 'x', at: Date.now() }));
  });

  it('người thường đọc supportIndex bị từ chối', async () => {
    await assertFails(db(user('A')).ref('supportIndex').once('value'));
  });

  it('email admin chưa xác minh đọc supportIndex bị từ chối', async () => {
    await assertFails(db(admin(false)).ref('supportIndex').once('value'));
  });

  it('người học ghi tin from admin bị từ chối', async () => {
    await assertFails(send(user('A'), 'A', 'm1', 'admin', Date.now()));
    await assertFails(db(user('A')).ref('support/A/messages/m1').set({ from: 'admin', text: 'x', at: Date.now() }));
  });

  it('ghi đè tin đã có bị từ chối', async () => {
    await seed('support/A/messages/m1', { from: 'user', text: 'hi', at: 1 });
    await assertFails(db(user('A')).ref('support/A/messages/m1').set({ from: 'user', text: 'sửa', at: Date.now() }));
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
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user', Date.now()));
  });

  it('tin kèm báo lỗi hợp lệ; trường lạ bị từ chối', async () => {
    const error = { message: 'boom', code: 'E1', page: '#/exam/x', at: 1 };
    await assertSucceeds(db(user('A')).ref('support/A/messages/m1').set({ from: 'user', text: '', at: Date.now(), error }));
    await assertFails(db(user('A')).ref('support/A/messages/m2').set({ from: 'user', text: 'x', at: Date.now(), extra: 1 }));
    await assertFails(db(user('A')).ref('support/A/messages/m3').set({ from: 'user', text: 'x'.repeat(4001), at: Date.now() }));
  });

  it('admin trả lời và đọc được cuộc trò chuyện', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user', Date.now()));
    await assertSucceeds(send(admin(), 'A', 'm2', 'admin', Date.now()));
    await assertSucceeds(db(admin()).ref('support/A').once('value'));
  });

  it('người học đọc cuộc trò chuyện và supportIndex của mình', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user', Date.now()));
    await assertSucceeds(db(user('A')).ref('support/A').once('value'));
    await assertSucceeds(db(user('A')).ref('supportIndex/A').once('value'));
  });

  it('admin đọc supportIndex (theo updatedAt)', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user', Date.now()));
    await assertSucceeds(db(admin()).ref('supportIndex').orderByChild('updatedAt').once('value'));
  });

  it('chống spam: người học gửi lần hai trong 3 giây bị từ chối, admin thì không', async () => {
    const t = Date.now();
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user', t));
    await assertFails(send(user('A'), 'A', 'm2', 'user', t + 1000));
    await assertSucceeds(send(user('A'), 'A', 'm3', 'user', t + 3000));
    await assertSucceeds(send(admin(), 'A', 'm4', 'admin', t + 3001));
  });

  it('updatedAt quá xa tương lai bị từ chối', async () => {
    await assertFails(send(user('A'), 'A', 'm1', 'user', Date.now() + 120000));
  });

  it('người học không giả email người khác', async () => {
    await assertFails(send(user('A'), 'A', 'm1', 'user', Date.now(), { 'supportIndex/A/email': 'khac@x.com' }));
  });

  it('đánh dấu đã đọc bằng đường dẫn con', async () => {
    await assertSucceeds(send(user('A'), 'A', 'm1', 'user', Date.now()));
    await assertSucceeds(db(admin()).ref('supportIndex/A/unreadByAdmin').set(false));
    await assertSucceeds(db(user('A')).ref('supportIndex/A/unreadByUser').set(false));
    await assertFails(db(user('B')).ref('supportIndex/A/unreadByUser').set(false));
    await assertFails(db(user('A')).ref('supportIndex/A/unreadByUser').set('no'));
  });
});
