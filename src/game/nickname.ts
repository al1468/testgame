const BANNED = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅂㅅ', '개새', '좆', '존나', '니미', 'fuck', 'shit', 'bitch'];

/** 닉네임 검사. 문제가 있으면 오류 메시지, 없으면 null */
export function validateNickname(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2 || name.length > 12) return '닉네임은 2~12자로 입력해 주세요.';
  if (!/^[\p{L}\p{N}_\- ]+$/u.test(name)) return '한글, 영문, 숫자, _, - 만 쓸 수 있어요.';
  const flat = name.replace(/[\s_\-]/g, '').toLowerCase();
  if (BANNED.some((w) => flat.includes(w))) return '사용할 수 없는 단어가 포함되어 있어요.';
  return null;
}
