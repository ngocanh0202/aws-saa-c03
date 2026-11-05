import type { SyncUser } from '../sync/types';

export const ADMIN_EMAIL = 'buihngocanh2@gmail.com';

/** Admin = đúng email admin và email đã được xác minh (không phân biệt hoa thường). */
export function isAdmin(user: SyncUser | null | undefined): boolean {
  return !!user && user.emailVerified === true && user.email?.toLowerCase() === ADMIN_EMAIL;
}
