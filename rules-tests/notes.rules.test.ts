import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Chạy bằng `npm run test:rules` (emulator Realtime Database, cần Java).
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-saa',
    database: { rules: readFileSync('database.rules.json', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearDatabase());

const db = (uid: string) => env.authenticatedContext(uid).database();
const good = { json: '{"qid":5}', updatedAt: 1 };

describe('notes rules', () => {
  it('chủ ghi và đọc users/A/notes/5', async () => {
    await assertSucceeds(db('A').ref('users/A/notes/5').set(good));
    await assertSucceeds(db('A').ref('users/A/notes/5').once('value'));
    await assertSucceeds(db('A').ref('users/A/notes').once('value'));
  });

  it('người khác đọc/ghi users/A/notes bị từ chối', async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.database().ref('users/A/notes/5').set(good));
    await assertFails(db('B').ref('users/A/notes').once('value'));
    await assertFails(db('B').ref('users/A/notes/5').set(good));
  });

  it('thiếu updatedAt bị từ chối', async () => {
    await assertFails(db('A').ref('users/A/notes/5').set({ json: '{}' }));
  });

  it('updatedAt không phải số bị từ chối', async () => {
    await assertFails(db('A').ref('users/A/notes/5').set({ json: '{}', updatedAt: 'x' }));
  });

  it('json dài 100000 bị từ chối, 99999 thì được', async () => {
    await assertFails(db('A').ref('users/A/notes/5').set({ json: 'x'.repeat(100000), updatedAt: 1 }));
    await assertSucceeds(db('A').ref('users/A/notes/5').set({ json: 'x'.repeat(99999), updatedAt: 1 }));
  });
});
