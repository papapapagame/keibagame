/** 固定8頭。各馬の能力合計は660。 */
window.Keiba = window.Keiba || {};

Keiba.HORSES = [
  {
    id: 1,
    name: 'ストームエース',
    speed: 92, stamina: 48, apt1000: 88, apt1200: 80, apt1600: 55,
    apt2000: 40, apt2400: 30, apt3200: 22, turf: 70, dirt: 85, condition: 50,
  },
  {
    id: 2,
    name: 'ミドリノキセキ',
    speed: 70, stamina: 72, apt1000: 40, apt1200: 48, apt1600: 78,
    apt2000: 82, apt2400: 70, apt3200: 45, turf: 90, dirt: 35, condition: 30,
  },
  {
    id: 3,
    name: 'クロノスゲイル',
    speed: 78, stamina: 80, apt1000: 35, apt1200: 42, apt1600: 60,
    apt2000: 75, apt2400: 88, apt3200: 82, turf: 65, dirt: 40, condition: 15,
  },
  {
    id: 4,
    name: 'レッドロック',
    speed: 65, stamina: 68, apt1000: 55, apt1200: 70, apt1600: 72,
    apt2000: 60, apt2400: 48, apt3200: 35, turf: 40, dirt: 88, condition: 59,
  },
  {
    id: 5,
    name: 'サクラノヒカリ',
    speed: 60, stamina: 75, apt1000: 30, apt1200: 38, apt1600: 65,
    apt2000: 80, apt2400: 85, apt3200: 78, turf: 82, dirt: 32, condition: 35,
  },
  {
    id: 6,
    name: 'ブルーインパルス',
    speed: 85, stamina: 55, apt1000: 75, apt1200: 82, apt1600: 70,
    apt2000: 50, apt2400: 35, apt3200: 25, turf: 55, dirt: 72, condition: 56,
  },
  {
    id: 7,
    name: 'ナイトシャドウ',
    speed: 72, stamina: 70, apt1000: 48, apt1200: 55, apt1600: 68,
    apt2000: 70, apt2400: 62, apt3200: 50, turf: 58, dirt: 60, condition: 47,
  },
  {
    id: 8,
    name: 'ゴールドレガシー',
    speed: 58, stamina: 88, apt1000: 25, apt1200: 32, apt1600: 50,
    apt2000: 72, apt2400: 90, apt3200: 95, turf: 75, dirt: 38, condition: 37,
  },
];

Keiba.assertAbilityTotals = function assertAbilityTotals() {
  for (const h of Keiba.HORSES) {
    const total =
      h.speed + h.stamina + h.apt1000 + h.apt1200 + h.apt1600 +
      h.apt2000 + h.apt2400 + h.apt3200 + h.turf + h.dirt + h.condition;
    if (total !== 660) {
      console.warn(`Horse ${h.id} ability sum is ${total}, expected 660`);
    }
  }
};
