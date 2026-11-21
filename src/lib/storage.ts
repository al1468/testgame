// localStorage는 시크릿 모드 등에서 막힐 수 있으므로 항상 try/catch

const NICK_KEY = 'instinct-dodge:nickname';
const MUTE_KEY = 'instinct-dodge:muted';
const LAST_ID_KEY = 'instinct-dodge:last-score-id';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장 실패해도 게임은 계속 */
  }
}

export const storage = {
  getNickname: () => get(NICK_KEY),
  setNickname: (v: string) => set(NICK_KEY, v),
  isMuted: () => get(MUTE_KEY) === '1',
  setMuted: (v: boolean) => set(MUTE_KEY, v ? '1' : '0'),
  getLastScoreId: () => get(LAST_ID_KEY),
  setLastScoreId: (v: string) => set(LAST_ID_KEY, v),
};
