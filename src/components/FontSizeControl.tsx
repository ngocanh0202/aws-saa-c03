import { FONT_SCALES, useFontScale } from '../app/font-scale';
import { useMobile } from '../notes/use-mobile';

/** Chỉnh cỡ chữ (A− / A+); chỉ hiện trên điện thoại vì cỡ chữ chỉ áp dụng ở đó. */
export function FontSizeControl({ english = false }: { english?: boolean }) {
  const mobile = useMobile();
  const [scale, step] = useFontScale();
  if (!mobile) return null;
  const label = english ? 'Font size' : 'Cỡ chữ';
  return (
    <div className="font-size" role="group" aria-label={label}>
      <span className="font-size__label">{label}</span>
      <button type="button" className="icon-btn" aria-label={english ? 'Smaller text' : 'Giảm cỡ chữ'} disabled={scale === FONT_SCALES[0]} onClick={() => step(-1)}>
        A−
      </button>
      <span className="font-size__value" aria-live="polite">
        {Math.round(scale * 100)}%
      </span>
      <button type="button" className="icon-btn" aria-label={english ? 'Larger text' : 'Tăng cỡ chữ'} disabled={scale === FONT_SCALES[FONT_SCALES.length - 1]} onClick={() => step(1)}>
        A+
      </button>
    </div>
  );
}
