import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import { memoryCooldownFor, type Cooldown } from '../ai/cooldown';
import type { LocalAiSettings } from '../ai/local-settings';
import type { useActiveAi } from '../components/GeminiChat';

export type ActiveAi = NonNullable<ReturnType<typeof useActiveAi>>;

/**
 * Khóa sau 429/503 và tham số ⚙ cho các nút AI soạn ghi chú. Như khung chat: Gemini dùng chung
 * cooldown của app, AI thử nghiệm có bản riêng; tham số chỉ có ở AI thử nghiệm.
 */
export function useNoteAiRuntime(active: ActiveAi): { cooldown: Cooldown; until: number | null; settings: LocalAiSettings | undefined } {
  const { aiGate, aiCooldown } = useApp();
  const { client, brand, uid, settingsStore } = active;
  const cooldown = brand === 'Gemini' ? (aiCooldown ?? memoryCooldownFor(aiGate)) : memoryCooldownFor(client);
  const until = useSyncExternalStore(cooldown.subscribe, cooldown.until);
  // Hết giờ khóa thì vẽ lại (cooldown không tự báo khi hết hạn).
  const [, tick] = useState(0);
  useEffect(() => {
    if (until === null) return;
    const t = setTimeout(() => tick((x) => x + 1), Math.max(0, until - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [until]);

  // Chưa tải xong hay tải lỗi thì để adapter dùng mặc định.
  const [settings, setSettings] = useState<LocalAiSettings | undefined>();
  useEffect(() => {
    if (!settingsStore) return;
    let live = true;
    settingsStore.load(uid).then(
      (s) => live && setSettings(s),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [settingsStore, uid]);

  return { cooldown, until, settings: settingsStore ? settings : undefined };
}
