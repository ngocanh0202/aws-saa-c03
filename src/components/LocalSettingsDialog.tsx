import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  DEFAULT_LOCAL_SETTINGS,
  LOCAL_NUMBER_PARAMS,
  LOCAL_TOGGLE_HELP,
  parseNumberField,
  type LocalAiSettings,
  type LocalNumberKey,
  type LocalNumberParam,
} from '../ai/local-settings';
import { ContactAdminButton } from './ContactAdminButton';

const SAVE_FAILED = 'Không lưu được cài đặt. Kiểm tra kết nối rồi thử lại.';

type Texts = Record<LocalNumberKey, string>;

const textsOf = (s: LocalAiSettings): Texts =>
  Object.fromEntries(LOCAL_NUMBER_PARAMS.map((p) => [p.key, s[p.key] === null ? '' : String(s[p.key])])) as Texts;

/** Tên tham số; di chuột hoặc chạm (focus) thì hiện hướng dẫn. */
function ParamName({ id, name, help }: { id: string; name: string; help: string }) {
  return (
    <span className="settings__help">
      <span className="settings__name" tabIndex={0} aria-describedby={`${id}-help`}>
        {name}
      </span>
      <span className="settings__tip" role="tooltip" id={`${id}-help`}>
        {help}
      </span>
    </span>
  );
}

/**
 * Popup ⚙ chỉnh tham số của AI thử nghiệm (nổi trên trang, không chuyển trang). Ô số kiểm tra ngay
 * khi gõ; còn ô sai thì khóa Lưu. Esc / ✕ / Hủy / bấm ra ngoài thì đóng mà không lưu.
 */
export function LocalSettingsDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: LocalAiSettings;
  onSave: (settings: LocalAiSettings) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const [texts, setTexts] = useState(() => textsOf(initial));
  const [stream, setStream] = useState(initial.stream);
  const [webSearch, setWebSearch] = useState(initial.webSearch);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => firstRef.current?.focus(), []);

  const parsed = LOCAL_NUMBER_PARAMS.map((p) => ({ p, r: parseNumberField(p, texts[p.key]) }));
  const valid = parsed.every(({ r }) => 'value' in r);

  const reset = () => {
    setTexts(textsOf(DEFAULT_LOCAL_SETTINGS));
    setStream(DEFAULT_LOCAL_SETTINGS.stream);
    setWebSearch(DEFAULT_LOCAL_SETTINGS.webSearch);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    const next = { ...initial, stream, webSearch } as LocalAiSettings;
    for (const { p, r } of parsed) if ('value' in r) (next as unknown as Record<string, number | null>)[p.key] = r.value;
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave(next);
      onClose();
    } catch {
      setSaveFailed(true);
      setSaving(false);
    }
  };

  const row = (p: LocalNumberParam, error: string | undefined) => {
    const inputId = `${id}-${p.key}`;
    return (
      <div className="settings__row" key={p.key}>
        <ParamName id={inputId} name={p.key} help={p.help} />
        <div>
          <input
            ref={p.key === 'temperature' ? firstRef : undefined}
            id={inputId}
            aria-label={p.key}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={texts[p.key]}
            placeholder={p.optional ? 'trống = không giới hạn' : undefined}
            aria-invalid={error ? true : undefined}
            aria-errormessage={error ? `${inputId}-error` : undefined}
            onChange={(e) => setTexts((t) => ({ ...t, [p.key]: e.target.value }))}
          />
          {error && (
            <p className="settings__error" id={`${inputId}-error`}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  };

  const toggle = (key: 'stream' | 'webSearch', name: string, checked: boolean, set: (v: boolean) => void) => {
    const inputId = `${id}-${key}`;
    return (
      <div className="settings__row" key={key}>
        <ParamName id={inputId} name={name} help={LOCAL_TOGGLE_HELP[key]} />
        <label className="settings__toggle">
          <input id={inputId} aria-label={name} type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} /> bật
        </label>
      </div>
    );
  };

  return (
    <div
      className="settings-backdrop"
      data-testid="settings-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      // Esc chỉ đóng popup này, không đóng cả khung chat (khung chat nghe keydown ở window).
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose();
      }}
    >
      <form className="settings" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onSubmit={submit} noValidate>
        <div className="settings__bar">
          <h2 id={`${id}-title`}>Cài đặt Hỏi AI</h2>
          <button type="button" className="icon-btn" aria-label="Đóng cài đặt" title="Đóng (Esc)" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="hint">Di chuột hoặc chạm vào tên tham số để xem hướng dẫn. Áp dụng từ câu hỏi tiếp theo.</p>
        <div className="settings__grid">
          {parsed.map(({ p, r }) => row(p, 'error' in r ? r.error : undefined))}
          {toggle('stream', 'stream', stream, setStream)}
          {toggle('webSearch', 'Tìm trên web', webSearch, setWebSearch)}
        </div>
        {saveFailed && (
          <p className="settings__error" role="alert">
            {SAVE_FAILED} <ContactAdminButton message={SAVE_FAILED} />
          </p>
        )}
        <div className="settings__actions">
          <button type="button" className="settings__reset" onClick={reset}>
            Mặc định
          </button>
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn-primary" disabled={!valid || saving}>
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}
