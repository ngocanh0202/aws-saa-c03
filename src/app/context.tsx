import { createContext, useContext, type ReactNode } from 'react';
import type { AiModeStore } from '../ai/ai-mode';
import type { Cooldown } from '../ai/cooldown';
import type { AiGate } from '../ai/gate';
import type { LocalSettingsStore } from '../ai/local-settings';
import type { AiClient, ChatHistoryStore } from '../ai/types';
import type { Bank } from '../data/bank';
import type { NotesStore } from '../notes/store';
import type { AttemptStore } from '../storage/storage';
import type { SupportStore } from '../support/types';
import type { SyncController } from '../sync/types';

export interface AppDeps {
  bank: Bank;
  store: AttemptStore;
  now: () => number;
  newSeed: () => number;
  newId: () => string;
  /** Đoạn tô và ghi chú theo câu, tách ngăn theo tài khoản. */
  notes: NotesStore;
  /** Mỗi tab chỉ một yêu cầu AI tại một thời điểm (chat hoặc soạn ghi chú). */
  aiGate: AiGate;
  /** Không có khi chưa cấu hình Firebase. */
  sync?: SyncController;
  /** Chỉ có khi cấu hình Firebase. */
  ai?: AiClient;
  /** Chỉ có khi cấu hình Firebase. */
  chats?: ChatHistoryStore;
  /** Khóa Gemini sau lỗi hết lượt (lưu localStorage); không có thì dùng bản trong bộ nhớ. */
  aiCooldown?: Cooldown;
  /** AI thử nghiệm (LM Studio); chỉ có khi có VITE_LOCAL_AI và Firebase. */
  localAi?: AiClient;
  /** Lịch sử chat của AI thử nghiệm (users/{uid}/localChats). */
  localChats?: ChatHistoryStore;
  /** Cài đặt ⚙ của AI thử nghiệm (users/{uid}/aiSettings); không có thì dùng mặc định, ẩn nút ⚙. */
  localSettings?: LocalSettingsStore;
  /** Chế độ đang chọn (Gemini/AI thử nghiệm); chỉ có khi có localAi. */
  aiMode?: AiModeStore;
  /** Khung hỗ trợ "Liên hệ admin"; chỉ có khi cấu hình Firebase. */
  support?: SupportStore;
}

const AppContext = createContext<AppDeps | null>(null);

export function AppProvider({ deps, children }: { deps: AppDeps; children: ReactNode }) {
  return <AppContext.Provider value={deps}>{children}</AppContext.Provider>;
}

export function useApp(): AppDeps {
  const deps = useContext(AppContext);
  if (!deps) throw new Error('useApp phải nằm trong AppProvider');
  return deps;
}
