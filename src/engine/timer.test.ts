import { formatClock, remainingMs } from './timer';

describe('timer', () => {
  it('remainingMs không âm', () => {
    expect(remainingMs(1000, 400)).toBe(600);
    expect(remainingMs(1000, 5000)).toBe(0);
  });

  it('formatClock hiển thị H:MM:SS, làm tròn lên giây', () => {
    expect(formatClock(130 * 60_000)).toBe('2:10:00');
    expect(formatClock(1)).toBe('0:00:01');
    expect(formatClock(0)).toBe('0:00:00');
    expect(formatClock(59_500)).toBe('0:01:00');
  });
});
