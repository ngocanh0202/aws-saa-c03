export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  appId: string;
}

/** Đọc cấu hình từ biến VITE_FIREBASE_*. Thiếu hoặc rỗng bất kỳ biến nào thì trả null (web chạy ở chế độ khách). */
export function readFirebaseConfig(env: Record<string, string | undefined>): FirebaseConfig | null {
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const databaseURL = env.VITE_FIREBASE_DATABASE_URL;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !databaseURL || !projectId || !appId) return null;
  return { apiKey, authDomain, databaseURL, projectId, appId };
}
