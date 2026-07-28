window.Keiba = window.Keiba || {};

(function (K) {
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  K.generateRaceSetup = function generateRaceSetup() {
    const surface = pick(K.SURFACES);
    const distance = pick(K.DISTANCES);
    const condition = pick(K.CONDITIONS);
    const forms = {};
    const styles = {};
    for (const h of K.HORSES) {
      forms[h.id] = randInt(1, 5);
      styles[h.id] = pick(K.RUNNING_STYLES);
    }
    return { surface, distance, condition, forms, styles };
  };

  function conditionWeight(condition) {
    switch (condition) {
      case '良': return 0.55;
      case '稍重': return 0.8;
      case '重': return 1.05;
      case '不良': return 1.25;
      default: return 1;
    }
  }

  function distanceMix(distance) {
    if (distance <= 1200) return { speed: 0.72, stamina: 0.28 };
    if (distance <= 1600) return { speed: 0.58, stamina: 0.42 };
    if (distance <= 2000) return { speed: 0.48, stamina: 0.52 };
    if (distance <= 2400) return { speed: 0.4, stamina: 0.6 };
    return { speed: 0.32, stamina: 0.68 };
  }

  K.calcRaceAbility = function calcRaceAbility(horse, setup) {
    const distKey = K.DISTANCE_KEY[setup.distance];
    const distApt = horse[distKey];
    const surfaceApt = setup.surface === '芝' ? horse.turf : horse.dirt;
    const mix = distanceMix(setup.distance);
    const cWeight = conditionWeight(setup.condition);

    const base =
      horse.speed * mix.speed +
      horse.stamina * mix.stamina +
      distApt * 0.55 +
      surfaceApt * 0.45 +
      horse.condition * cWeight * 0.35;

    const form = setup.forms[horse.id] || 3;
    return base * K.FORM_MULTIPLIER[form];
  };

  K.calcWinRates = function calcWinRates(abilities) {
    const POWER = 2.35;
    const scores = abilities.map((a) => Math.pow(Math.max(a, 1), POWER));
    let sum = scores.reduce((s, v) => s + v, 0);
    let rates = scores.map((s) => s / sum);

    const MAX = 0.35;
    for (let guard = 0; guard < 8; guard += 1) {
      const overIdx = rates.findIndex((r) => r > MAX + 1e-9);
      if (overIdx < 0) break;
      const excess = rates[overIdx] - MAX;
      rates[overIdx] = MAX;
      const others = rates
        .map((r, i) => ({ r, i }))
        .filter((x) => x.i !== overIdx && x.r < MAX);
      const otherSum = others.reduce((s, x) => s + x.r, 0) || 1;
      for (const o of others) {
        rates[o.i] += excess * (o.r / otherSum);
      }
    }

    sum = rates.reduce((s, v) => s + v, 0);
    return rates.map((r) => r / sum);
  };

  function weightedPick(ids, weightsById) {
    let total = 0;
    for (const id of ids) total += weightsById[id];
    let r = Math.random() * total;
    for (const id of ids) {
      r -= weightsById[id];
      if (r <= 0) return id;
    }
    return ids[ids.length - 1];
  }

  K.drawFinishOrder = function drawFinishOrder(horses, winRatesById) {
    const remaining = horses.map((h) => h.id);
    const order = [];
    while (remaining.length > 0) {
      const picked = weightedPick(remaining, winRatesById);
      order.push(picked);
      remaining.splice(remaining.indexOf(picked), 1);
    }
    return order;
  };

  K.prepareRace = function prepareRace(setup) {
    const abilities = {};
    for (const h of K.HORSES) {
      abilities[h.id] = K.calcRaceAbility(h, setup);
    }

    const abilityList = K.HORSES.map((h) => abilities[h.id]);
    const rateList = K.calcWinRates(abilityList);
    const winRates = {};
    K.HORSES.forEach((h, i) => {
      winRates[h.id] = rateList[i];
    });

    const popularity = [...K.HORSES]
      .sort((a, b) => winRates[b.id] - winRates[a.id] || a.id - b.id)
      .map((h) => h.id);

    const finishOrder = K.drawFinishOrder(K.HORSES, winRates);

    return { setup, abilities, winRates, popularity, finishOrder };
  };

  K.formatFormStars = function formatFormStars(form) {
    return '★'.repeat(form);
  };
})(window.Keiba);
