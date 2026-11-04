import { describe, expect, it, vi } from 'vitest';
import type { FirebaseConfig } from '../sync/config';
import { buildAiDeps, DEFAULT_GEMINI_MODEL } from './deps';
import { fakeAi, fakeChats } from '../test/fake-ai';

const base: FirebaseConfig = { apiKey: 'k', authDomain: 'a', databaseURL: 'd', projectId: 'p', appId: 'i' };
const clients = { app: {} as never, chats: fakeChats() };

describe('buildAiDeps', () => {
  it('không có khóa reCAPTCHA thì không có ai (App Check bắt buộc cho Gemini), vẫn giữ chats', () => {
    const create = vi.fn(() => fakeAi());
    const deps = buildAiDeps(base, clients, create);
    expect(deps.ai).toBeUndefined();
    expect(deps.chats).toBe(clients.chats);
    expect(create).not.toHaveBeenCalled();
  });

  it('có khóa thì tạo ai với model mặc định', () => {
    const ai = fakeAi();
    const create = vi.fn(() => ai);
    const deps = buildAiDeps({ ...base, recaptchaSiteKey: 'rk' }, clients, create);
    expect(deps.ai).toBe(ai);
    expect(create).toHaveBeenCalledWith(clients.app, DEFAULT_GEMINI_MODEL);
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.5-flash');
  });

  it('dùng VITE_GEMINI_MODEL nếu có', () => {
    const create = vi.fn(() => fakeAi());
    buildAiDeps({ ...base, recaptchaSiteKey: 'rk', geminiModel: 'x' }, clients, create);
    expect(create).toHaveBeenCalledWith(clients.app, 'x');
  });

  it('có cấu hình Local AI và Firebase thì tạo localAi (không cần reCAPTCHA) và localChats', () => {
    const local = fakeAi();
    const createLocal = vi.fn(() => local);
    const localChats = fakeChats();
    const deps = buildAiDeps(base, { ...clients, localChats }, vi.fn(), { config: { url: 'https://t', model: 'm' }, create: createLocal });
    expect(deps.ai).toBeUndefined();
    expect(deps.localAi).toBe(local);
    expect(deps.localChats).toBe(localChats);
    expect(createLocal).toHaveBeenCalledWith('https://t', 'm');
  });

  it('không có cấu hình Local AI thì không có localAi', () => {
    const deps = buildAiDeps(base, { ...clients, localChats: fakeChats() }, vi.fn(), { config: null, create: vi.fn() });
    expect(deps.localAi).toBeUndefined();
  });

  it('không có clients thì không có gì', () => {
    expect(buildAiDeps(null, null, vi.fn())).toEqual({ ai: undefined, chats: undefined });
  });
});
