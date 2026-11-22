// ❓ 이벤트 노드: 텍스트 + 선택지. 결과는 런 시드로 결정되어 재현 가능.

export interface EventOutcome {
  text: string;
  gold?: number;
  /** 살아있는 아군 HP 변화 (최대 HP 비율, 음수면 피해. 피해로는 쓰러지지 않음) */
  hpPct?: number;
  /** 파티 전원 경험치 */
  xp?: number;
  /** 무작위 유물 획득 */
  relic?: boolean;
  /** 무작위 동료 영입 (자리가 없으면 대신 경험치 +60) */
  recruit?: boolean;
}

export interface EventChoice {
  label: string;
  requiresGold?: number;
  /** 확률(합 1)과 결과 */
  outcomes: { chance: number; outcome: EventOutcome }[];
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  choices: EventChoice[];
}

const sure = (outcome: EventOutcome) => [{ chance: 1, outcome }];

export const EVENTS: EventDef[] = [
  {
    id: "wounded_awakener",
    title: "쓰러진 각성자",
    text: "벽에 기댄 채 숨을 몰아쉬는 각성자가 있다. \"…도와줄 수 있나?\"",
    choices: [
      {
        label: "치료해 준다 (골드 30)",
        requiresGold: 30,
        outcomes: sure({ text: "치료를 받은 각성자가 고개를 숙인다. \"은혜는 갚겠다.\"", gold: -30, recruit: true }),
      },
      {
        label: "소지품만 챙긴다",
        outcomes: sure({ text: "그의 가방에서 골드를 찾았다. 등 뒤로 원망 섞인 시선이 느껴진다.", gold: 60 }),
      },
      { label: "지나친다", outcomes: sure({ text: "당신은 발걸음을 재촉했다." }) },
    ],
  },
  {
    id: "vending_machine",
    title: "수상한 자판기",
    text: "불이 들어온 자판기가 홀로 서 있다. 진열된 물건들이 미묘하게 빛난다.",
    choices: [
      {
        label: "동전을 넣는다 (골드 20)",
        requiresGold: 20,
        outcomes: [
          { chance: 0.5, outcome: { text: "덜컹! 무언가가 떨어졌다.", gold: -20, relic: true } },
          { chance: 0.5, outcome: { text: "자판기는 동전만 삼키고 조용해졌다.", gold: -20 } },
        ],
      },
      {
        label: "발로 찬다",
        outcomes: sure({ text: "동전이 쏟아졌지만, 감전되어 파티 전원이 다쳤다.", gold: 40, hpPct: -0.1 }),
      },
      { label: "무시한다", outcomes: sure({ text: "괜히 건드리지 않기로 했다." }) },
    ],
  },
  {
    id: "ancient_tablet",
    title: "고대 석판",
    text: "알 수 없는 문자가 새겨진 석판. [시스템] 해독 시 경험을 얻을 수 있습니다.",
    choices: [
      { label: "해독한다", outcomes: sure({ text: "머릿속에 지식이 흘러들어 온다.", xp: 80 }) },
      {
        label: "부숴서 파편을 판다",
        outcomes: sure({ text: "파편은 꽤 값이 나갔지만, 튀어 오른 마력에 다쳤다.", gold: 50, hpPct: -0.15 }),
      },
    ],
  },
  {
    id: "herb_garden",
    title: "약초 정원",
    text: "탑 안에 어울리지 않는 작은 정원. 은은한 향기가 피로를 씻어낸다.",
    choices: [
      { label: "약초를 먹는다", outcomes: sure({ text: "몸이 가벼워졌다.", hpPct: 0.3 }) },
      { label: "약초를 캐서 판다", outcomes: sure({ text: "상인에게 팔면 쏠쏠하겠다.", gold: 45 }) },
    ],
  },
  {
    id: "tower_trial",
    title: "탑의 시련",
    text: "[시스템] 시련에 도전하시겠습니까? 성공 시 보상이 주어집니다.",
    choices: [
      {
        label: "도전한다",
        outcomes: [
          { chance: 0.7, outcome: { text: "[시스템] 시련 성공. 보상이 지급됩니다.", relic: true } },
          { chance: 0.3, outcome: { text: "[시스템] 시련 실패. 대가를 치릅니다.", hpPct: -0.25 } },
        ],
      },
      { label: "거절한다", outcomes: sure({ text: "[시스템] 시련을 거부했습니다." }) },
    ],
  },
  {
    id: "wandering_merchant",
    title: "떠돌이 상인",
    text: "\"좋은 물건 있어요~ 딱 하나 남았는데.\" 수상한 상인이 손짓한다.",
    choices: [
      {
        label: "산다 (골드 50)",
        requiresGold: 50,
        outcomes: sure({ text: "\"탁월한 선택이에요!\"", gold: -50, relic: true }),
      },
      { label: "거절한다", outcomes: sure({ text: "상인은 어깨를 으쓱하고 사라졌다." }) },
    ],
  },
];

export function getEvent(id: string): EventDef {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`unknown event ${id}`);
  return e;
}
