/** Tham số gửi kèm mỗi request của AI thử nghiệm (LM Studio, Unsloth…), tên trùng tên trong API kiểu OpenAI. */
export interface LocalAiSettings {
  temperature: number;
  top_p: number;
  top_k: number;
  min_p: number;
  presence_penalty: number;
  /** null = không giới hạn (không gửi). */
  max_tokens: number | null;
  stream: boolean;
  /** Dặn AI tra cứu web (nếu có tool) và ghi link nguồn khi người học hỏi thông tin mới nhất. */
  webSearch: boolean;
}

export const DEFAULT_LOCAL_SETTINGS: LocalAiSettings = {
  temperature: 0.7,
  top_p: 0.8,
  top_k: 20,
  min_p: 0,
  presence_penalty: 0,
  max_tokens: null,
  stream: true,
  webSearch: true,
};

export type LocalNumberKey = 'temperature' | 'top_p' | 'top_k' | 'min_p' | 'presence_penalty' | 'max_tokens';

export interface LocalNumberParam {
  key: LocalNumberKey;
  min: number;
  max: number;
  /** true: min không được tính (top_p phải > 0). */
  minExclusive?: boolean;
  integer?: boolean;
  /** Để trống được (null). */
  optional?: boolean;
  help: string;
}

export const LOCAL_NUMBER_PARAMS: LocalNumberParam[] = [
  {
    key: 'temperature',
    min: 0,
    max: 2,
    help: 'Độ "sáng tạo" khi chọn chữ. Thấp (0–0.3): trả lời ổn định, sát ý. Cao (trên 1): đa dạng hơn nhưng dễ lan man, dễ sai.',
  },
  {
    key: 'top_p',
    min: 0,
    max: 1,
    minExclusive: true,
    help: 'Chỉ chọn chữ tiếp theo trong nhóm khả năng cao nhất có tổng xác suất bằng top_p. Nhỏ hơn: tập trung, ít lan man. 1: không giới hạn.',
  },
  {
    key: 'top_k',
    min: 0,
    max: 1000,
    integer: true,
    help: 'Mỗi bước chỉ xét k chữ có khả năng cao nhất. Nhỏ: chắc chắn hơn, ít bất ngờ. 0: tắt giới hạn này.',
  },
  {
    key: 'min_p',
    min: 0,
    max: 1,
    help: 'Bỏ các chữ có xác suất thấp hơn min_p × xác suất của chữ cao nhất. Tăng lên: bớt chữ lạ, lạc đề. 0: tắt.',
  },
  {
    key: 'presence_penalty',
    min: -2,
    max: 2,
    help: 'Phạt các chữ đã xuất hiện. Dương: bớt lặp ý, hay chuyển sang ý mới. Âm: dễ lặp lại. 0: không phạt.',
  },
  {
    key: 'max_tokens',
    min: 1,
    max: 32768,
    integer: true,
    optional: true,
    help: 'Độ dài tối đa của câu trả lời, tính bằng token (khoảng ¾ từ tiếng Anh). Để trống: không giới hạn. Model có phần suy nghĩ cũng tốn token cho phần đó, đừng đặt quá nhỏ.',
  },
];

export const LOCAL_TOGGLE_HELP: Record<'stream' | 'webSearch', string> = {
  stream: 'Bật: chữ hiện dần trong lúc model đang viết. Tắt: chờ model viết xong rồi hiện cả câu trả lời một lần.',
  webSearch:
    'Bật: khi bạn hỏi thông tin mới nhất, AI tra cứu web nếu máy chủ có công cụ tìm kiếm và ghi link nguồn, không có thì nói rõ. Tắt: AI chỉ trả lời theo kiến thức sẵn có.',
};

function rangeError(p: LocalNumberParam): string {
  if (p.minExclusive) return `Phải là số lớn hơn ${p.min}, tối đa ${p.max}.`;
  return `Phải là số${p.integer ? ' nguyên' : ''} từ ${p.min} đến ${p.max}.`;
}

function inRange(p: LocalNumberParam, n: number): boolean {
  if (!Number.isFinite(n) || n > p.max || (p.minExclusive ? n <= p.min : n < p.min)) return false;
  return !p.integer || Number.isInteger(n);
}

/** Kiểm tra chữ trong ô nhập; ô tùy chọn để trống thì value = null. */
export function parseNumberField(p: LocalNumberParam, raw: string): { value: number | null } | { error: string } {
  const text = raw.trim();
  if (!text) return p.optional ? { value: null } : { error: 'Không được để trống.' };
  const n = /^-?(\d+([.,]\d*)?|[.,]\d+)$/.test(text) ? Number(text.replace(',', '.')) : NaN;
  return inRange(p, n) ? { value: n } : { error: rangeError(p) };
}

/** Đọc bản lưu trên Firebase; trường thiếu hoặc hỏng thì dùng mặc định. */
export function parseLocalSettings(raw: unknown): LocalAiSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: LocalAiSettings = { ...DEFAULT_LOCAL_SETTINGS };
  for (const p of LOCAL_NUMBER_PARAMS) {
    const v = src[p.key];
    if (typeof v === 'number' && inRange(p, v)) out[p.key] = v;
  }
  if (typeof src.stream === 'boolean') out.stream = src.stream;
  if (typeof src.webSearch === 'boolean') out.webSearch = src.webSearch;
  return out;
}

/** Phần tham số trong body request (không gồm stream; max_tokens trống thì bỏ). */
export function samplingBody(s: LocalAiSettings): Record<string, number> {
  const { temperature, top_p, top_k, min_p, presence_penalty, max_tokens } = s;
  return { temperature, top_p, top_k, min_p, presence_penalty, ...(max_tokens !== null ? { max_tokens } : {}) };
}

/** Lưu cài đặt theo tài khoản (users/{uid}/aiSettings). */
export interface LocalSettingsStore {
  /** Chưa lưu lần nào thì trả mặc định. */
  load(uid: string): Promise<LocalAiSettings>;
  save(uid: string, settings: LocalAiSettings): Promise<void>;
}
