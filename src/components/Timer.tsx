import { useEffect, useRef, useState } from 'react';
import { formatClock, remainingMs } from '../engine/timer';

interface TimerProps {
  endsAt: number;
  now: () => number;
  label: string;
  onExpire: () => void;
}

export function Timer({ endsAt, now, label, onExpire }: TimerProps) {
  const [remaining, setRemaining] = useState(() => remainingMs(endsAt, now()));
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    const tick = () => {
      const r = remainingMs(endsAt, now());
      setRemaining(r);
      if (r === 0) onExpireRef.current();
      return r === 0;
    };
    if (tick()) return;
    const handle = setInterval(() => {
      if (tick()) clearInterval(handle);
    }, 1000);
    return () => clearInterval(handle);
  }, [endsAt, now]);

  return (
    <span className={`timer${remaining < 5 * 60_000 ? ' timer--low' : ''}`} role="timer">
      {label}: {formatClock(remaining)}
    </span>
  );
}
