import { validateNickname } from '../game/nickname';
import { fetchTop, rankingEnabled } from '../lib/supabase';
import { storage } from '../lib/storage';

const root = () => document.getElementById('overlay') as HTMLDivElement;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function overlayOpen(): boolean {
  return !root().hidden;
}

export function closeOverlay() {
  const el = root();
  el.hidden = true;
  el.innerHTML = '';
}

function open(html: string): HTMLDivElement {
  const el = root();
  el.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`;
  el.hidden = false;
  return el.firstElementChild as HTMLDivElement;
}

/** 닉네임 입력 창. 확인하면 onDone(닉네임) 호출 */
export function showNicknamePanel(onDone: (name: string) => void, onCancel?: () => void) {
  const current = storage.getNickname() ?? '';
  const panel = open(`
    <h2>닉네임 입력</h2>
    <p>랭킹에 표시될 이름이에요. (2~12자)</p>
    <input id="nick" maxlength="12" autocomplete="off" spellcheck="false" value="${escapeHtml(current)}" placeholder="예: 본능의카이" />
    <div class="error" id="nick-err"></div>
    <div class="row">
      ${onCancel ? '<button class="btn" id="nick-cancel">취소</button>' : ''}
      <button class="btn primary" id="nick-ok">확인</button>
    </div>
  `);
  const input = panel.querySelector<HTMLInputElement>('#nick')!;
  const err = panel.querySelector<HTMLDivElement>('#nick-err')!;
  const submit = () => {
    const msg = validateNickname(input.value);
    if (msg) {
      err.textContent = msg;
      input.focus();
      return;
    }
    const name = input.value.trim();
    storage.setNickname(name);
    closeOverlay();
    onDone(name);
  };
  panel.querySelector('#nick-ok')!.addEventListener('click', submit);
  panel.querySelector('#nick-cancel')?.addEventListener('click', () => {
    closeOverlay();
    onCancel?.();
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape' && onCancel) {
      closeOverlay();
      onCancel();
    }
  });
  setTimeout(() => input.focus(), 30);
}

export function showHelpPanel(onClose: () => void) {
  const panel = open(`
    <h2>조작법 · 규칙</h2>
    <ul class="rules">
      <li>적이 공격하기 전 <b>황금 링</b>이 카이에게 모여들어요. 링이 안쪽 원과 겹치는 순간 <b>회피</b>!</li>
      <li>PC: <b>Space</b> · 모바일: <b>화면 탭</b> · 일시정지: <b>Esc</b></li>
      <li>정확할수록 <b>PERFECT</b>(±0.08초) &gt; <b>GOOD</b>(±0.16초). 너무 일찍 누르면 잠깐 움직일 수 없어요.</li>
      <li>회피에 성공하면 <b>본능 게이지</b>가 차고, 가득 차면 카이가 각성해 <b>자동으로 반격</b>해요.</li>
      <li>적은 반격으로만 쓰러뜨릴 수 있어요. 쓰러뜨리면 더 강한 적이 나타나요.</li>
      <li>4단계부터는 <b>페이크 공격</b>! 링이 도중에 깨지면 누르지 마세요.</li>
      <li>연속 회피 콤보가 쌓이면 점수 배율이 올라가요 (10콤보 ×1.5, 25콤보 ×2, 50콤보 ×3).</li>
      <li>공격을 맞으면 체력이 1 줄고, 5번 맞으면 게임 오버. 적을 쓰러뜨리면 체력 1 회복.</li>
    </ul>
    <div class="row"><button class="btn primary" id="help-ok">알겠어요</button></div>
  `);
  panel.querySelector('#help-ok')!.addEventListener('click', () => {
    closeOverlay();
    onClose();
  });
}

export function showRankingPanel(onClose: () => void) {
  const panel = open(`
    <h2>랭킹 TOP 50</h2>
    <div class="rank-list" id="rank-body"><div class="status">불러오는 중…</div></div>
    <div class="row">
      <button class="btn" id="rank-refresh">새로고침</button>
      <button class="btn primary" id="rank-close">닫기</button>
    </div>
  `);
  const body = panel.querySelector<HTMLDivElement>('#rank-body')!;
  const load = async () => {
    if (!rankingEnabled) {
      body.innerHTML = '<div class="status">랭킹 서버가 아직 설정되지 않았어요.<br/>(Supabase 환경 변수를 확인해 주세요)</div>';
      return;
    }
    body.innerHTML = '<div class="status">불러오는 중…</div>';
    try {
      const rows = await fetchTop(50);
      if (rows.length === 0) {
        body.innerHTML = '<div class="status">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!</div>';
        return;
      }
      const myId = storage.getLastScoreId();
      body.innerHTML = `
        <table>
          <thead><tr><th>#</th><th>닉네임</th><th>점수</th><th>처치</th><th class="hide-sm">콤보</th><th class="hide-sm">날짜</th></tr></thead>
          <tbody>
            ${rows
              .map((r, i) => {
                const cls = [r.id === myId ? 'me' : '', i < 3 ? 'top' : ''].join(' ');
                const date = new Date(r.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
                return `<tr class="${cls}"><td>${i + 1}</td><td>${escapeHtml(r.nickname)}</td><td>${r.score.toLocaleString()}</td><td>${r.enemies_defeated}</td><td class="hide-sm">${r.max_combo}</td><td class="hide-sm">${date}</td></tr>`;
              })
              .join('')}
          </tbody>
        </table>`;
    } catch (e) {
      console.error(e);
      body.innerHTML = '<div class="status">랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>';
    }
  };
  panel.querySelector('#rank-refresh')!.addEventListener('click', load);
  panel.querySelector('#rank-close')!.addEventListener('click', () => {
    closeOverlay();
    onClose();
  });
  void load();
}
