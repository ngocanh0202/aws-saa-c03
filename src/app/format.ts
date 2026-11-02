import type { Mode } from '../engine/attempt';

export function modeName(mode: Mode): string {
  return mode === 'real' ? 'Thi thật' : 'Thi thử';
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}
