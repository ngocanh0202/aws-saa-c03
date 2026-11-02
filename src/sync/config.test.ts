import { describe, expect, it } from 'vitest';
import { readFirebaseConfig } from './config';

const full = {
  VITE_FIREBASE_API_KEY: 'k',
  VITE_FIREBASE_AUTH_DOMAIN: 'p.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://p-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'p',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
};

describe('readFirebaseConfig', () => {
  it('đủ 5 biến thì trả config', () => {
    expect(readFirebaseConfig(full)).toEqual({
      apiKey: 'k',
      authDomain: 'p.firebaseapp.com',
      databaseURL: 'https://p-default-rtdb.firebaseio.com',
      projectId: 'p',
      appId: '1:2:web:3',
    });
  });

  it('đọc VITE_RECAPTCHA_SITE_KEY và VITE_GEMINI_MODEL khi có', () => {
    const cfg = readFirebaseConfig({ ...full, VITE_RECAPTCHA_SITE_KEY: 'rc', VITE_GEMINI_MODEL: 'gemini-x' });
    expect(cfg?.recaptchaSiteKey).toBe('rc');
    expect(cfg?.geminiModel).toBe('gemini-x');
  });

  it('thiếu hai biến này vẫn trả cấu hình, trường là undefined', () => {
    const cfg = readFirebaseConfig({ ...full, VITE_RECAPTCHA_SITE_KEY: '', VITE_GEMINI_MODEL: '' });
    expect(cfg).not.toBeNull();
    expect(cfg?.recaptchaSiteKey).toBeUndefined();
    expect(cfg?.geminiModel).toBeUndefined();
  });

  it('thiếu một biến thì null', () => {
    const { VITE_FIREBASE_APP_ID: _omit, ...rest } = full;
    expect(readFirebaseConfig(rest)).toBeNull();
  });

  it('biến rỗng thì null', () => {
    expect(readFirebaseConfig({ ...full, VITE_FIREBASE_API_KEY: '' })).toBeNull();
  });
});
