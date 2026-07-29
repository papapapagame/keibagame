/** 定数・設定 */
window.Keiba = window.Keiba || {};

Keiba.INITIAL_MONEY = 100000;
Keiba.PAYOUT_RATE = 0.9;
Keiba.HORSE_COUNT = 8;
Keiba.STORAGE_KEY = 'keiba_game_v1';
Keiba.FORM_UNIT = 100;

Keiba.SURFACES = ['芝', 'ダート'];
Keiba.DISTANCES = [1000, 1200, 1600, 2000, 2400, 3200];
Keiba.CONDITIONS = ['良', '稍重', '重', '不良'];

Keiba.FORM_MULTIPLIER = {
  1: 0.86,
  2: 0.93,
  3: 1.0,
  4: 1.07,
  5: 1.14,
};

Keiba.BET_TYPES = {
  win: { id: 'win', label: '単勝', picks: 1, ordered: false, formation: false },
  place: { id: 'place', label: '複勝', picks: 1, ordered: false, formation: false },
  quinella: {
    id: 'quinella', label: '馬連', picks: 2, ordered: false,
    formation: 'matrix', columns: 3, activeColumns: 2,
  },
  exacta: {
    id: 'exacta', label: '馬単', picks: 2, ordered: true,
    formation: 'matrix', columns: 3, activeColumns: 2,
  },
  trio: {
    id: 'trio', label: '三連複', picks: 3, ordered: false,
    formation: 'matrix', columns: 3, activeColumns: 3,
  },
  trifecta: {
    id: 'trifecta', label: '三連単', picks: 3, ordered: true,
    formation: 'matrix', columns: 3, activeColumns: 3,
  },
};

Keiba.FORM_COLUMN_LABELS = ['①', '②', '③'];
Keiba.POSITION_LABELS = ['1着', '2着', '3着'];
Keiba.FORM_TAB_TYPES = ['quinella', 'exacta', 'trio', 'trifecta'];

Keiba.ABILITY_LABELS = [
  { key: 'speed', label: 'スピード' },
  { key: 'stamina', label: 'スタミナ' },
  { key: 'apt1000', label: '1000m適性' },
  { key: 'apt1200', label: '1200m適性' },
  { key: 'apt1600', label: '1600m適性' },
  { key: 'apt2000', label: '2000m適性' },
  { key: 'apt2400', label: '2400m適性' },
  { key: 'apt3200', label: '3200m適性' },
  { key: 'turf', label: '芝適性' },
  { key: 'dirt', label: 'ダート適性' },
  { key: 'condition', label: '馬場適性' },
];

Keiba.DISTANCE_KEY = {
  1000: 'apt1000',
  1200: 'apt1200',
  1600: 'apt1600',
  2000: 'apt2000',
  2400: 'apt2400',
  3200: 'apt3200',
};

Keiba.RACE_DURATION = { min: 28, max: 32 };
/** キャラ画像パス（SVG） */
Keiba.HORSE_IMAGE_PATH = (id) => `img/chars/char-${id}.svg`;
