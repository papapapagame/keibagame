window.Keiba = window.Keiba || {};

(function (K) {
  /** 仮想コース長（鼻先座標。ゴール線 = TRACK_LENGTH） */
  const TRACK_LENGTH = 2400;
  const RUNOUT_LENGTH = 720;
  /** 1着を画面のどの位置に置くか（やや左寄り＝前方の馬も見える） */
  const WINNER_CAMERA_ANCHOR = 0.42;
  const CAMERA_FOLLOW = 3.2;
  /** ゴール固定時、ゴール線を画面のどこに置くか */
  const FINISH_CAMERA_ANCHOR = 0.62;
  /** 着差（秒） */
  const PLACE_GAP_SEC = 0.55;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** 単調増加の折れ線補間 */
  function polyLerp(u, keys, values) {
    if (u <= keys[0]) return values[0];
    for (let i = 1; i < keys.length; i += 1) {
      if (u <= keys[i]) {
        const t = (u - keys[i - 1]) / (keys[i] - keys[i - 1]);
        return lerp(values[i - 1], values[i], t);
      }
    }
    return values[values.length - 1];
  }

  /** 脚質の序盤押し出し（0=後方寄り, 1=前方寄り） */
  function styleFrontBias(style) {
    switch (style) {
      case '逃げ':
        return 0.95;
      case '先行':
        return 0.72;
      case '差し':
        return 0.38;
      case '追込':
        return 0.18;
      default:
        return 0.5;
    }
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
   * 道中は脚質で前後が入れ替わり、終盤で着順どおりに収束する進捗カーブ。
   * u=0..1（各馬のゴール時刻基準）→ 0..1（鼻先進捗）
   */
  function progressFraction(u, place, style) {
    u = clamp(u, 0, 1);
    const front = styleFrontBias(style);
    const place01 = (place - 1) / 7; // 0=1着 … 1=8着
    const lateStrength = 1 - place01; // 1着ほど終盤強い

    // 序盤〜中盤: 逃げ先行が前、差し追込は控える
    const p18 = 0.10 + front * 0.14;
    const p36 = 0.22 + front * 0.20;
    // 中盤で一度散らす（逃げ残り vs 差し浮上の交差を作る）
    const p52 = 0.38 + front * 0.10 + lateStrength * 0.08;
    // 直線: 着順へ急速に寄せる（見た目の逆転が起きやすい帯）
    const p72 = 0.55 + lateStrength * 0.22 + front * 0.02;
    const p88 = 0.78 + lateStrength * 0.16;

    const raw = polyLerp(
      u,
      [0, 0.18, 0.36, 0.52, 0.72, 0.88, 1],
      [0, p18, p36, p52, p72, p88, 1]
    );

    // わずかに加速感を残しつつ終端速度を確保
    return 0.9 * raw + 0.1 * u;
  }

  function estimateExitSpeed(id, finishAt, place, stylesById) {
    const style = stylesById[id] || '先行';
    const eps = 1 / 60;
    const u0 = Math.max(0, 1 - eps / finishAt);
    const p0 = progressFraction(u0, place, style);
    return (TRACK_LENGTH * (1 - p0)) / Math.max(eps, finishAt * (1 - u0));
  }

  function noseX(id, elapsed, finishTimes, placeById, stylesById, exitSpeed) {
    const finishAt = finishTimes[id];
    const place = placeById.get(id) || 4;
    const style = stylesById[id] || '先行';
    if (elapsed <= 0) return 0;
    if (elapsed < finishAt) {
      return TRACK_LENGTH * progressFraction(elapsed / finishAt, place, style);
    }
    const speed = exitSpeed.get(id) || TRACK_LENGTH / Math.max(1, finishAt);
    return TRACK_LENGTH + speed * (elapsed - finishAt);
  }

  /**
   * 1着をアンカーに隊列幅を抑え、前後の馬が画面に残りやすくする
   */
  function fitPackAroundAnchor(positions, anchorId, maxSpan) {
    const anchorX = positions.get(anchorId);
    if (anchorX == null) {
      let minX = Infinity;
      let maxX = -Infinity;
      for (const x of positions.values()) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      return { positions, minX, maxX };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    for (const x of positions.values()) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    const span = maxX - minX;
    if (span <= maxSpan || span < 1e-6) {
      return { positions, minX, maxX };
    }

    const fitted = new Map();
    const scale = maxSpan / span;
    for (const [id, x] of positions) {
      fitted.set(id, anchorX + (x - anchorX) * scale);
    }
    return {
      positions: fitted,
      minX: anchorX + (minX - anchorX) * scale,
      maxX: anchorX + (maxX - anchorX) * scale,
    };
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
    stylesById,
    raceDistance = 1600,
    onComplete,
  }) {
    const duration =
      K.RACE_DURATION.min +
      Math.random() * (K.RACE_DURATION.max - K.RACE_DURATION.min);

    const finishTimes = assignFinishTimes(finishOrder, duration);
    const placeById = new Map(finishOrder.map((id, i) => [id, i + 1]));
    const winnerId = finishOrder[0];

    const exitSpeed = new Map();
    finishOrder.forEach((id) => {
      exitSpeed.set(
        id,
        estimateExitSpeed(id, finishTimes[id], placeById.get(id), stylesById)
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
    let winnerFinished = false;
    const lastFinishAt = Math.max(...Object.values(finishTimes));

    function viewWidth() {
      return trackEl.clientWidth || 1;
    }

    function horseWidth(el) {
      return el.offsetWidth || 54;
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

      const vw = viewWidth();
      const raw = new Map();

      for (const id of runners.keys()) {
        const x = noseX(
          id,
          elapsed,
          finishTimes,
          placeById,
          stylesById,
          exitSpeed
        );
        raw.set(id, x);

        if (x >= TRACK_LENGTH && !flagged.has(id)) {
          flagged.add(id);
          plantPlaceFlag(lanesById.get(id), placeById.get(id));
        }
      }

      if (!winnerFinished && raw.get(winnerId) >= TRACK_LENGTH) {
        winnerFinished = true;
      }

      // 未ゴール馬＋1着を中心に軽く圧縮（道中の前後入れ替えは残す）
      const racing = new Map();
      const done = new Map();
      for (const [id, x] of raw) {
        if (x >= TRACK_LENGTH) done.set(id, x);
        else racing.set(id, x);
      }

      let positions;
      if (racing.size > 0) {
        const maxSpan = Math.max(150, vw * 0.78 - 56);
        const pack = new Map(racing);
        // 1着がまだ走っているならアンカーに含める
        if (!winnerFinished) pack.set(winnerId, raw.get(winnerId));
        const fitted = fitPackAroundAnchor(
          pack,
          winnerFinished ? [...racing.keys()][0] : winnerId,
          maxSpan
        );
        positions = new Map([...fitted.positions, ...done]);
        // 圧縮後も1着の生座標を優先（カメラ追従の基準を安定させる）
        if (!winnerFinished) positions.set(winnerId, raw.get(winnerId));
      } else {
        positions = done;
      }

      let targetCam;
      if (!winnerFinished) {
        const winnerNose = positions.get(winnerId) ?? raw.get(winnerId);
        targetCam = Math.max(0, winnerNose - vw * WINNER_CAMERA_ANCHOR);
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
        const nose = positions.get(id) ?? raw.get(id);
        const left = nose - horseWidth(el);
        el.style.transform = `translate3d(${left}px, -50%, 0)`;
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
