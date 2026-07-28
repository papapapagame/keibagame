window.Keiba = window.Keiba || {};

(function (K) {
  const IDS = () => K.HORSES.map((h) => h.id);

  function sortedKey(nums) {
    return [...nums].sort((a, b) => a - b).join('-');
  }

  K.buildOrderProbabilities = function buildOrderProbabilities(winRatesById) {
    const probs = new Map();
    const ids = IDS();

    function dfs(remaining, prefix, prefixProb) {
      if (remaining.length === 0) {
        probs.set(prefix.join('-'), prefixProb);
        return;
      }
      let weightSum = 0;
      for (const id of remaining) weightSum += winRatesById[id];
      for (let i = 0; i < remaining.length; i += 1) {
        const id = remaining[i];
        const p = winRatesById[id] / weightSum;
        const next = remaining.slice(0, i).concat(remaining.slice(i + 1));
        dfs(next, prefix.concat(id), prefixProb * p);
      }
    }

    dfs(ids, [], 1);
    return probs;
  };

  K.calcHitProbabilities = function calcHitProbabilities(winRatesById) {
    const orderProbs = K.buildOrderProbabilities(winRatesById);
    const ids = IDS();

    const win = Object.fromEntries(ids.map((id) => [id, 0]));
    const place = Object.fromEntries(ids.map((id) => [id, 0]));
    const quinella = {};
    const exacta = {};
    const trio = {};
    const trifecta = {};

    for (const [key, p] of orderProbs) {
      const order = key.split('-').map(Number);
      const first = order[0];
      const second = order[1];
      const third = order[2];

      win[first] += p;
      place[first] += p;
      place[second] += p;
      place[third] += p;

      const qKey = sortedKey([first, second]);
      quinella[qKey] = (quinella[qKey] || 0) + p;

      const eKey = `${first}-${second}`;
      exacta[eKey] = (exacta[eKey] || 0) + p;

      const tKey = sortedKey([first, second, third]);
      trio[tKey] = (trio[tKey] || 0) + p;

      const tfKey = `${first}-${second}-${third}`;
      trifecta[tfKey] = (trifecta[tfKey] || 0) + p;
    }

    return { win, place, quinella, exacta, trio, trifecta, orderProbs };
  };

  function oddsFromProb(prob) {
    if (prob <= 0) return 9999.9;
    const odds = K.PAYOUT_RATE / prob;
    return Math.max(1.0, Math.round(odds * 10) / 10);
  }

  K.buildOddsTable = function buildOddsTable(winRatesById) {
    const hit = K.calcHitProbabilities(winRatesById);
    const table = {
      win: {},
      place: {},
      quinella: {},
      exacta: {},
      trio: {},
      trifecta: {},
      hit,
    };

    for (const id of IDS()) {
      table.win[id] = oddsFromProb(hit.win[id]);
      table.place[id] = oddsFromProb(hit.place[id]);
    }
    for (const [k, p] of Object.entries(hit.quinella)) {
      table.quinella[k] = oddsFromProb(p);
    }
    for (const [k, p] of Object.entries(hit.exacta)) {
      table.exacta[k] = oddsFromProb(p);
    }
    for (const [k, p] of Object.entries(hit.trio)) {
      table.trio[k] = oddsFromProb(p);
    }
    for (const [k, p] of Object.entries(hit.trifecta)) {
      table.trifecta[k] = oddsFromProb(p);
    }

    return table;
  };

  K.betKey = function betKey(type, picks) {
    const meta = K.BET_TYPES[type];
    if (!meta) return '';
    if (meta.ordered) return picks.join('-');
    return sortedKey(picks);
  };

  K.getOdds = function getOdds(oddsTable, type, picks) {
    if (type === 'win' || type === 'place') {
      return oddsTable[type][picks[0]] ?? 0;
    }
    return oddsTable[type][K.betKey(type, picks)] ?? 0;
  };

  K.settleBet = function settleBet(bet, finishOrder) {
    const { type, picks, amount, odds } = bet;
    const top3 = finishOrder.slice(0, 3);
    const top2 = finishOrder.slice(0, 2);
    let hit = false;

    switch (type) {
      case 'win':
        hit = picks[0] === finishOrder[0];
        break;
      case 'place':
        hit = top3.includes(picks[0]);
        break;
      case 'quinella':
        hit = sortedKey(picks) === sortedKey(top2);
        break;
      case 'exacta':
        hit = picks[0] === finishOrder[0] && picks[1] === finishOrder[1];
        break;
      case 'trio':
        hit = sortedKey(picks) === sortedKey(top3);
        break;
      case 'trifecta':
        hit =
          picks[0] === finishOrder[0] &&
          picks[1] === finishOrder[1] &&
          picks[2] === finishOrder[2];
        break;
      default:
        hit = false;
    }

    return { hit, payout: hit ? Math.floor(amount * odds) : 0 };
  };

  K.formatBetLabel = function formatBetLabel(type, picks, horseNameById) {
    const label = K.BET_TYPES[type].label;
    if (type === 'quinella' || type === 'trio') {
      return `${label} ${picks.slice().sort((a, b) => a - b).join('-')}`;
    }
    if (type === 'exacta' || type === 'trifecta') {
      return `${label} ${picks.join('→')}`;
    }
    return `${label} ${picks[0]}`;
  };
})(window.Keiba);
