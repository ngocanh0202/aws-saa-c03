import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSyncController } from '../sync/controller';
import type { SyncUser } from '../sync/types';
import { createStore } from '../storage/storage';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';

const USER: SyncUser = { uid: 'u1', name: 'An Nguyen' };
const LOADING = 'Đang đồng bộ dữ liệu với tài khoản Google…';

function setup() {
  const store = createStore(memoryStorage(), { now: () => 500 });
  const auth = fakeAuth();
  const remote = fakeRemote();
  const sync = createSyncController({ store, auth, remote });
  return { auth, remote, deps: makeDeps({ store, sync }) };
}

describe('Màn hình đồng bộ', () => {
  it('đang tải dữ liệu cloud thì phủ màn hình loading, tải xong thì ẩn', () => {
    const { auth, remote, deps } = setup();
    renderApp('/', deps);
    expect(screen.queryByText(LOADING)).toBeNull();
    act(() => auth.emit(USER));
    expect(screen.getByRole('status', { name: LOADING })).toBeTruthy();
    act(() => remote.emit('u1'));
    expect(screen.queryByText(LOADING)).toBeNull();
  });

  it('khách (chưa đăng nhập) không thấy màn hình loading', () => {
    const { auth, deps } = setup();
    renderApp('/', deps);
    act(() => auth.emit(null));
    expect(screen.queryByText(LOADING)).toBeNull();
  });
});
