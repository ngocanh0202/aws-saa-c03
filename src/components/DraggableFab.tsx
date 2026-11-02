import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

const POS_KEY = 'saa-c03:exam-fab';
const SIZE = 56;
const MARGIN = 8;
/** Kéo quá ngưỡng này (px) thì coi là kéo, thả ra không tính là bấm. */
const DRAG_THRESHOLD = 6;

interface Pos {
  x: number;
  y: number;
}

function clamp(pos: Pos): Pos {
  const maxX = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
  return { x: Math.min(Math.max(pos.x, MARGIN), maxX), y: Math.min(Math.max(pos.y, MARGIN), maxY) };
}

/** Vị trí người dùng đã kéo tới (null = chưa kéo, nút bám góc dưới bên phải). */
function readSaved(): Pos | null {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null') as Pos | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
  } catch {
    // localStorage bị chặn hoặc dữ liệu hỏng: dùng vị trí mặc định
  }
  return null;
}

function defaultPos(): Pos {
  return { x: window.innerWidth - SIZE - 16, y: window.innerHeight - SIZE - 24 };
}

/** Nút tròn nổi, kéo thả được (vị trí được nhớ); bấm (không kéo) thì gọi onClick. */
export function DraggableFab({ label, expanded, controls, onClick, children }: { label: string; expanded: boolean; controls: string; onClick: () => void; children: ReactNode }) {
  const [saved, setSaved] = useState(readSaved);
  // Tính lại vị trí mỗi lần đổi kích thước/xoay màn hình, để nút không bị kẹt ngoài vùng nhìn thấy
  // (ví dụ trang mở ở khổ máy tính rồi mới thu nhỏ, hoặc vị trí đã lưu từ màn hình lớn hơn).
  const [, setViewport] = useState(0);
  useEffect(() => {
    const onResize = () => setViewport((v) => v + 1);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  const pos = clamp(saved ?? defaultPos());
  const drag = useRef<{ startX: number; startY: number; origin: Pos; moved: boolean } | null>(null);
  // Sau khi kéo, trình duyệt vẫn bắn click: cờ này để bỏ qua đúng một click đó.
  const wasDragged = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, origin: pos, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setSaved(clamp({ x: d.origin.x + dx, y: d.origin.y + dy }));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    wasDragged.current = true;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      // bỏ qua
    }
  };

  return (
    <button
      type="button"
      className="exam-fab"
      style={{ left: pos.x, top: pos.y }}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onClick={() => {
        if (wasDragged.current) {
          wasDragged.current = false;
          return;
        }
        onClick();
      }}
    >
      {children}
    </button>
  );
}
