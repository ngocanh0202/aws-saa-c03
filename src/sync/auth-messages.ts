/** Lỗi không rõ nguyên nhân thì kèm dòng này để người dùng biết hỏi ai. */
export const SUPPORT_HINT = 'Nếu vẫn lỗi, vui lòng liên hệ admin.';

/** Mã lỗi Firebase Auth → câu báo tiếng Việt. */
const MESSAGES: Record<string, string> = {
  'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup cho trang này rồi bấm đăng nhập lại.',
  'auth/account-exists-with-different-credential':
    'Email này đã đăng ký bằng cách đăng nhập khác (Google, Facebook hoặc Email). Hãy đăng nhập bằng cách đã dùng trước đó.',
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
  'auth/invalid-login-credentials': 'Email hoặc mật khẩu không đúng.',
  'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
  'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
  'auth/email-already-in-use': 'Email này đã có tài khoản. Chọn "Đăng nhập", hoặc dùng cách đăng nhập đã đăng ký trước đó (Google, Facebook).',
  'auth/weak-password': 'Mật khẩu quá yếu: cần ít nhất 6 ký tự.',
  'auth/password-does-not-meet-requirements': 'Mật khẩu chưa đủ mạnh theo quy định của trang. Thử mật khẩu dài hơn, có chữ hoa, chữ thường và số.',
  'auth/invalid-email': 'Email không hợp lệ.',
  'auth/user-disabled': 'Tài khoản này đã bị khóa. Vui lòng liên hệ admin.',
  'auth/too-many-requests': 'Thử sai quá nhiều lần. Đợi một lúc rồi thử lại.',
  'auth/network-request-failed': 'Mất kết nối mạng. Kiểm tra mạng rồi thử lại.',
  'auth/operation-not-allowed': `Cách đăng nhập này chưa được bật. ${SUPPORT_HINT}`,
  'auth/unauthorized-domain': `Trang này chưa được phép đăng nhập (Authorized domains). ${SUPPORT_HINT}`,
};

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && MESSAGES[code]) return MESSAGES[code];
  const message = err instanceof Error ? err.message : String(err);
  return `Không đăng nhập được: ${message}. ${SUPPORT_HINT}`;
}
