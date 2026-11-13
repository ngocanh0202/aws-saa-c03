import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from '../components/icons';
import { Markdown } from '../components/Markdown';
import type { NoteEntry } from './entries';
import { buildDeck } from './flashcards';

/** Vuốt ngang tối thiểu (px) để chuyển thẻ; ngắn hơn thì coi là bấm lật. */
const SWIPE_PX = 60;

/**
 * Ôn ghi chú bằng flashcard: mặt trước là tiêu đề, bấm (hoặc Space/Enter) lật ra nội dung. Thứ tự ngẫu nhiên,
 * "Xáo lại" để xáo lần nữa. Trước/Sau bằng nút, mũi tên trái/phải, hoặc vuốt trên điện thoại. Esc đóng.
 */
export function FlashcardsDialog({ entries, onClose }: { entries: NoteEntry[]; onClose: () => void }) {
  const [deck, setDeck] = useState(() => buildDeck(entries));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = deck[index];

  const go = (to: number) => {
    if (to < 0 || to >= deck.length) return;
    setIndex(to);
    setFlipped(false);
  };
  const reshuffle = () => {
    setDeck(buildDeck(entries));
    setIndex(0);
    setFlipped(false);
  };

  // Bàn phím ở cấp trang để không cần focus vào thẻ.
  const keys = useRef({ go, index, onClose });
  useLayoutEffect(() => {
    keys.current = { go, index, onClose };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const k = keys.current;
      if (e.key === 'Escape') k.onClose();
      else if (e.key === 'ArrowRight') k.go(k.index + 1);
      else if (e.key === 'ArrowLeft') k.go(k.index - 1);
      else if ((e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement)) setFlipped((f) => !f);
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Vuốt ngang để chuyển thẻ; khi đó bỏ cú click đi kèm để thẻ không bị lật.
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const onPointerDown = (e: PointerEvent) => {
    start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onPointerUp = (e: PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
    swiped.current = true;
    go(dx < 0 ? index + 1 : index - 1);
  };
  const onClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    setFlipped((f) => !f);
  };

  return createPortal(
    <div className="flashcards" role="dialog" aria-modal="true" aria-label="Ôn flashcard">
      <div className="flashcards__bar">
        <span className="flashcards__count">
          {index + 1}/{deck.length}
        </span>
        <button type="button" onClick={reshuffle}>
          Xáo lại
        </button>
        <button type="button" className="icon-btn" aria-label="Đóng" title="Đóng (Esc)" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      {card && (
        <div
          className={`flashcard${flipped ? ' is-flipped' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={flipped}
          aria-label={flipped ? `Thẻ ghi chú, mặt sau: ${card.title}` : `Thẻ ghi chú, mặt trước: ${card.title}`}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={onClick}
        >
          <div className="flashcard__inner">
            <div className="flashcard__face flashcard__face--front" aria-hidden={flipped}>
              <p className="flashcard__title">{card.source === 'highlight' ? <mark className="hl">{card.title}</mark> : card.title}</p>
              <p className="flashcard__hint">Bấm để lật</p>
            </div>
            <div className="flashcard__face flashcard__face--back" aria-hidden={!flipped}>
              <div className="flashcard__body">
                {card.source === 'ai' ? <Markdown text={card.content} /> : <p className="flashcard__content">{card.content}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flashcards__nav">
        <button type="button" aria-label="Thẻ trước" disabled={index === 0} onClick={() => go(index - 1)}>
          ← Trước
        </button>
        <button type="button" className="btn-primary" aria-label="Thẻ sau" disabled={index >= deck.length - 1} onClick={() => go(index + 1)}>
          Sau →
        </button>
      </div>
    </div>,
    document.body,
  );
}
