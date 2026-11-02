import type { Mode } from '../engine/attempt';

export function modeName(mode: Mode): string {
  return mode === 'real' ? 'Thi thật' : 'Thi thử';
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

/** Đề sub dùng id 1…7 ("Đề 3"), đề main dùng id 101…112 ("Main 3"). */
export function setLabel(setId: number): string {
  return setId > 100 ? `Main ${setId - 100}` : `Đề ${setId}`;
}
