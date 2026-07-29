window.Keiba = window.Keiba || {};

(function (K) {
  /** 仮想コース長（鼻先座標。ゴール線 = TRACK_LENGTH） */
  const TRACK_LENGTH = 2400;
  const RUNOUT_LENGTH = 720;
  const LEAD_CAMERA_ANCHOR = 0.4;
  const CAMERA_FOLLOW = 3.2;
  const FINISH_CAMERA_ANCHOR = 0.62;
  const PLACE_GAP_SEC = 0.55;
  /** 道中の最低速度（px/秒）。停止・後退を防ぐ */
  const MIN_SPEED = 28;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function assignFinishTimes(finishOrder, duration) {
    const times = {};
    const firstAt = duration * 0.84;
    finishOrder.forEach((id, place) => {
      times[id] = firstAt + place * PLACE_GAP_SEC;
    });
    return times;
  }

  /**
   * 各馬の道中経路（常に前進・速度の緩急のみ）。
   * 着順とは無関係。パターンは毎回ランダム。
   */
  function buildForwardPaths(horseIds, stretchStart) {
    const ids = horseIds.slice();
    const patternRoll = Math.random();
    const pattern =
      patternRoll < 0.3 ? 'holdLead' : patternRoll < 0.58 ? 'lateSurge' : 'chaos';

    const focusId = ids[Math.floor(Math.random() * ids.length)];
    const baseSpeed = (TRACK_LENGTH * 0.82) / Math.max(1, stretchStart);
    const paths = new Map();

    ids.forEach((id) => {
      const times = [0];
      let t = 0.7 + Math.random() * 0.9;
      while (t < stretchStart - 0.35) {
        times.push(t);
        t += 0.9 + Math.random() * 1.7;
      }
      times.push(stretchStart);

      const points = [{ t: 0, x: 0 }];
      let x = 0;

      for (let i = 1; i < times.length; i += 1) {
        const t0 = times[i - 1];
        const t1 = times[i];
        const dt = Math.max(0.05, t1 - t0);
        const phase = t1 / stretchStart;

        // 基準より速い／遅いだけで前後が入れ替わる
        let mul = 0.55 + Math.random() * 0.95;

        if (pattern === 'holdLead' && id === focusId) {
          mul *= phase < 0.75 ? 1.22 : 0.92;
        } else if (pattern === 'holdLead' && phase < 0.55) {
          mul *= 0.78 + Math.random() * 0.28;
        }

        if (pattern === 'lateSurge' && id === focusId) {
          mul *= phase < 0.4 ? 0.62 : phase < 0.7 ? 1.05 : 1.4;
        } else if (pattern === 'lateSurge' && phase > 0.55) {
          mul *= 0.8 + Math.random() * 0.25;
        }

        if (pattern === 'chaos') {
          mul = 0.5 + Math.random() * 1.15;
        }

        const speed = Math.max(MIN_SPEED, baseSpeed * mul);
        x += speed * dt;
        points.push({ t: t1, x });
      }

      // 直線手前で隊列が散らばりすぎないよう、到達位置を帯に収める（比率スケールなので単調性は維持）
      const targetEnd = TRACK_LENGTH * (0.72 + Math.random() * 0.12);
      const scale = targetEnd / Math.max(1, x);
      for (let i = 1; i < points.length; i += 1) {
        points[i].x *= scale;
        // 念のため各区間に最低前進を保証
        const minX = points[i - 1].x + MIN_SPEED * (points[i].t - points[i - 1].t) * 0.35;
        if (points[i].x < minX) points[i].x = minX;
      }

      paths.set(id, points);
    });

    return { paths, pattern, focusId };
  }

  /** 単調増加パス上の位置 */
  function pathX(points, elapsed) {
    if (!points || !points.length) return 0;
    if (elapsed <= points[0].t) return points[0].x;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      if (elapsed <= b.t) {
        const u = (elapsed - a.t) / Math.max(0.001, b.t - a.t);
        return lerp(a.x, b.x, u);
      }
    }
    return points[points.length - 1].x;
  }

  function remainingMarkerMeters(raceDistance) {
    const step = raceDistance >= 2400 ? 400 : 200;
    const marks = [];
    for (let m = raceDistance - step; m >= step; m -= step) {
      marks.push(m);
    }
    if (raceDistance > 200 && !marks.includes(200)) marks.push(200);
    return marks.sort((a, b) => b - a);
  }

  function placeDistanceMarkers(container, raceDistance) {
    if (!container) return;
    container.innerHTML = '';

    const start = document.createElement('div');
    start.className = 'distance-board is-start';
    start.style.left = '0px';
    start.innerHTML =
      '<div class="distance-board-sign">START</div><div class="distance-board-pole"></div>';
    container.appendChild(start);

    for (const meters of remainingMarkerMeters(raceDistance)) {
      const x = TRACK_LENGTH * (1 - meters / raceDistance);
      const board = document.createElement('div');
      board.className = 'distance-board';
      board.style.left = `${x}px`;
      board.innerHTML =
        `<div class="distance-board-sign"><span class="distance-board-label">残り</span>` +
        `<span class="distance-board-m">${meters}</span><span class="distance-board-unit">m</span></div>` +
        '<div class="distance-board-pole"></div>';
      container.appendChild(board);
    }

    const goal = document.createElement('div');
    goal.className = 'distance-board is-goal';
    goal.style.left = `${TRACK_LENGTH}px`;
    goal.innerHTML =
      '<div class="distance-board-sign">GOAL</div><div class="distance-board-pole"></div>';
    container.appendChild(goal);
  }

  function plantPlaceFlag(laneEl, place) {
    if (!laneEl || laneEl.querySelector('.place-flag')) return;
    const flag = document.createElement('div');
    flag.className = `place-flag place-${place}`;
    flag.style.left = `${TRACK_LENGTH + 10}px`;
    flag.innerHTML =
      `<span class="place-flag-banner">${place}</span>` +
      '<span class="place-flag-pole"></span>';
    laneEl.appendChild(flag);
  }

  K.createRaceAnimation = function createRaceAnimation({
    trackEl,
    lanesEl,
    timerEl,
    finishOrder,
    raceDistance = 1600,
    onComplete,
  }) {
    const duration =
      K.RACE_DURATION.min +
      Math.random() * (K.RACE_DURATION.max - K.RACE_DURATION.min);

    const finishTimes = assignFinishTimes(finishOrder, duration);
    const placeById = new Map(finishOrder.map((id, i) => [id, i + 1]));
    const horseIds = finishOrder.slice().sort((a, b) => a - b);
    const firstFinishAt = finishTimes[finishOrder[0]];
    const stretchStart = firstFinishAt * 0.9;
    const drama = buildForwardPaths(horseIds, stretchStart);

    const stretchStartX = new Map();
    const exitSpeed = new Map();
    horseIds.forEach((id) => {
      const x0 = pathX(drama.paths.get(id), stretchStart);
      stretchStartX.set(id, x0);
      const span = Math.max(0.25, finishTimes[id] - stretchStart);
      // ゴールまでも最低速度以上で前進
      exitSpeed.set(
        id,
        Math.max(MIN_SPEED, (TRACK_LENGTH - x0) / span)
      );
    });

    const runners = new Map();
    const lanesById = new Map();
    const flagged = new Set();
    const worldEl = K.$('track-world');
    const bgEl = K.$('track-bg');
    const finishEl = K.$('finish-line');
    const railEl = K.$('lane-rail');
    const markersEl = K.$('distance-markers');

    placeDistanceMarkers(markersEl, raceDistance);

    if (railEl) {
      railEl.innerHTML = '';
      for (let i = 1; i <= 8; i += 1) {
        const lab = document.createElement('div');
        lab.className = `lane-rail-num num-${i}`;
        lab.textContent = String(i);
        railEl.appendChild(lab);
      }
    }

    lanesEl.innerHTML = '';
    for (let i = 1; i <= 8; i += 1) {
      const lane = document.createElement('div');
      lane.className = 'lane';

      const horse = K.HORSES.find((h) => h.id === i);
      const runner = document.createElement('div');
      runner.className = `horse-runner num-${i}`;
      runner.title = horse ? horse.name : '';

      const bob = document.createElement('div');
      bob.className = 'horse-bob';

      const img = document.createElement('img');
      img.className = 'horse-sprite';
      img.alt = horse ? horse.name : `馬${i}`;
      img.src = K.HORSE_IMAGE_PATH(i);
      img.draggable = false;
      img.addEventListener('error', () => {
        img.remove();
        runner.classList.add('no-image');
      });

      const badge = document.createElement('span');
      badge.className = 'horse-badge';
      badge.textContent = String(i);

      bob.appendChild(img);
      bob.appendChild(badge);
      runner.appendChild(bob);
      lane.appendChild(runner);

      runners.set(i, runner);
      lanesById.set(i, lane);
      lanesEl.appendChild(lane);
    }

    if (finishEl) finishEl.style.left = `${TRACK_LENGTH}px`;
    if (worldEl) worldEl.style.width = `${TRACK_LENGTH + RUNOUT_LENGTH}px`;

    let raf = 0;
    let start = 0;
    let lastNow = 0;
    let cameraX = 0;
    let finished = false;
    let firstHorseFinished = false;
    const lastFinishAt = Math.max(...Object.values(finishTimes));
    const lastNose = new Map();

    function horseWidth(el) {
      return el.offsetWidth || 54;
    }

    function noseX(id, elapsed) {
      const tFin = finishTimes[id];
      if (elapsed <= 0) return 0;
      if (elapsed < stretchStart) {
        return pathX(drama.paths.get(id), elapsed);
      }
      if (elapsed < tFin) {
        const u = (elapsed - stretchStart) / Math.max(0.001, tFin - stretchStart);
        return lerp(stretchStartX.get(id), TRACK_LENGTH, clamp(u, 0, 1));
      }
      return TRACK_LENGTH + exitSpeed.get(id) * (elapsed - tFin);
    }

    function frame(now) {
      if (!start) {
        start = now;
        lastNow = now;
      }
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      const elapsed = (now - start) / 1000;
      if (timerEl) timerEl.textContent = `${elapsed.toFixed(1)}s`;

      const vw = trackEl.clientWidth || 1;
      let leadNose = 0;
      const positions = new Map();

      for (const id of runners.keys()) {
        let x = noseX(id, elapsed);
        // 表示上も後退しない
        const prev = lastNose.get(id) ?? 0;
        if (x < prev) x = prev;
        lastNose.set(id, x);
        positions.set(id, x);

        if (x > leadNose) leadNose = x;

        if (x >= TRACK_LENGTH && !flagged.has(id)) {
          flagged.add(id);
          plantPlaceFlag(lanesById.get(id), placeById.get(id));
        }
      }

      if (!firstHorseFinished && leadNose >= TRACK_LENGTH) {
        firstHorseFinished = true;
      }

      let targetCam;
      if (!firstHorseFinished) {
        targetCam = Math.max(0, leadNose - vw * LEAD_CAMERA_ANCHOR);
      } else {
        targetCam = Math.max(0, TRACK_LENGTH - vw * FINISH_CAMERA_ANCHOR);
      }

      const follow = 1 - Math.exp(-CAMERA_FOLLOW * dt);
      cameraX += (targetCam - cameraX) * follow;

      if (worldEl) {
        worldEl.style.transform = `translate3d(${-cameraX}px, 0, 0)`;
      }
      if (bgEl) {
        bgEl.style.backgroundPosition = `${-cameraX * 0.4}px 0, ${-cameraX * 0.7}px 0`;
      }

      for (const [id, el] of runners) {
        const nose = positions.get(id);
        el.style.transform = `translate3d(${nose - horseWidth(el)}px, -50%, 0)`;
        el.style.zIndex = String(10 + Math.floor(nose / 8));
      }

      if (elapsed >= lastFinishAt + 2.4 && !finished) {
        finished = true;
        if (onComplete) setTimeout(() => onComplete(), 500);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    return {
      start() {
        raf = requestAnimationFrame(frame);
      },
      stop() {
        if (raf) cancelAnimationFrame(raf);
      },
      duration,
    };
  };
})(window.Keiba);
