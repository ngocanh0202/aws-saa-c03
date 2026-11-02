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

  it('thiếu một biến thì null', () => {
    const { VITE_FIREBASE_APP_ID: _omit, ...rest } = full;
    expect(readFirebaseConfig(rest)).toBeNull();
  });

  it('biến rỗng thì null', () => {
    expect(readFirebaseConfig({ ...full, VITE_FIREBASE_API_KEY: '' })).toBeNull();
  });
});
