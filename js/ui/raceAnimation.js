window.Keiba = window.Keiba || {};

(function (K) {
  /** 仮想コース長（鼻先座標。ゴール線 = TRACK_LENGTH） */
  const TRACK_LENGTH = 2400;
  /** ゴール後のコース延長 */
  const RUNOUT_LENGTH = 720;
  /** 先頭寄りカメラ */
  const CAMERA_ANCHOR = 0.38;
  const CAMERA_FOLLOW = 3.0;
  /** 着差（秒）。鼻先通過が目で追える間隔 */
  const PLACE_GAP_SEC = 0.55;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function cubicBezierEase(t, x1, y1, x2, y2) {
    t = clamp(t, 0, 1);
    let u = t;
    for (let i = 0; i < 5; i += 1) {
      const x = bezierX(u, x1, x2) - t;
      const dx = bezierDX(u, x1, x2);
      if (Math.abs(dx) < 1e-6) break;
      u = clamp(u - x / dx, 0, 1);
    }
    return bezierY(u, y1, y2);
  }

  function bezierX(u, x1, x2) {
    const c = 3 * x1;
    const b = 3 * (x2 - x1) - c;
    const a = 1 - c - b;
    return ((a * u + b) * u + c) * u;
  }

  function bezierDX(u, x1, x2) {
    const c = 3 * x1;
    const b = 3 * (x2 - x1) - c;
    const a = 1 - c - b;
    return (3 * a * u + 2 * b) * u + c;
  }

  function bezierY(u, y1, y2) {
    const c = 3 * y1;
    const b = 3 * (y2 - y1) - c;
    const a = 1 - c - b;
    return ((a * u + b) * u + c) * u;
  }

  /** 脚質（端点固定。終端速度は progressCurve 側で確保） */
  function styleWarp(style, u) {
    switch (style) {
      case '逃げ':
        return cubicBezierEase(u, 0.28, 0.36, 0.55, 0.72);
      case '先行':
        return cubicBezierEase(u, 0.32, 0.32, 0.58, 0.68);
      case '差し':
        return cubicBezierEase(u, 0.38, 0.26, 0.62, 0.78);
      case '追込':
        return cubicBezierEase(u, 0.44, 0.20, 0.66, 0.84);
      default:
        return u;
    }
  }

  /**
   * 0..1 → 0..1。線形寄りで終端の傾きを残し、ゴールで急停止しない。
   */
  function progressCurve(style, u) {
    u = clamp(u, 0, 1);
    return 0.74 * u + 0.26 * styleWarp(style, u);
  }

  function assignFinishTimes(finishOrder, duration) {
    const times = {};
    const firstAt = duration * 0.84;
    finishOrder.forEach((id, place) => {
      times[id] = firstAt + place * PLACE_GAP_SEC;
    });
    return times;
  }

  /** 鼻先のワールドX。ゴール後も同じ速度感で走り抜け */
  function noseX(id, elapsed, finishTimes, stylesById, exitSpeed) {
    const finishAt = finishTimes[id];
    const style = stylesById[id] || '先行';
    if (elapsed <= 0) return 0;
    if (elapsed < finishAt) {
      return TRACK_LENGTH * progressCurve(style, elapsed / finishAt);
    }
    const speed = exitSpeed.get(id) || TRACK_LENGTH / Math.max(1, finishAt);
    return TRACK_LENGTH + speed * (elapsed - finishAt);
  }

  function estimateExitSpeed(id, finishAt, stylesById) {
    const style = stylesById[id] || '先行';
    const eps = 1 / 60;
    const u0 = Math.max(0, 1 - eps / finishAt);
    const p0 = progressCurve(style, u0);
    return (TRACK_LENGTH * (1 - p0)) / Math.max(eps, finishAt * (1 - u0));
  }

  /** 未ゴール馬だけ圧縮（ゴール順を壊さない） */
  function fitPackToView(positions, maxSpan) {
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
    const scale = maxSpan / span;
    const fitted = new Map();
    for (const [id, x] of positions) {
      fitted.set(id, maxX - (maxX - x) * scale);
    }
    return { positions: fitted, minX: maxX - maxSpan, maxX };
  }

  function packCameraTarget(minX, maxX, vw) {
    const horseW = 54;
    const padL = vw * 0.04 + horseW * 0.15;
    const padR = vw * 0.1 + horseW;
    const prefer = maxX - vw * CAMERA_ANCHOR;
    const camMin = maxX + padR - vw;
    const camMax = minX - padL;
    if (camMin <= camMax) {
      return Math.max(0, clamp(prefer, camMin, camMax));
    }
    return Math.max(0, minX - padL);
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
    const exitSpeed = new Map();
    finishOrder.forEach((id) => {
      exitSpeed.set(id, estimateExitSpeed(id, finishTimes[id], stylesById));
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
    if (worldEl) {
      worldEl.style.width = `${TRACK_LENGTH + RUNOUT_LENGTH}px`;
    }

    let raf = 0;
    let start = 0;
    let lastNow = 0;
    let cameraX = 0;
    let finished = false;
    const lastFinishAt = Math.max(...Object.values(finishTimes));
    const placeById = new Map(finishOrder.map((id, i) => [id, i + 1]));

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
      const racing = new Map();
      const done = new Map();

      for (const id of runners.keys()) {
        const x = noseX(id, elapsed, finishTimes, stylesById, exitSpeed);
        if (x >= TRACK_LENGTH) {
          done.set(id, x);
          if (!flagged.has(id)) {
            flagged.add(id);
            plantPlaceFlag(lanesById.get(id), placeById.get(id));
          }
        } else {
          racing.set(id, x);
        }
      }

      let positions;
      let camMinX;
      let camMaxX;

      if (racing.size > 0) {
        // 終盤は圧縮を緩めて着差が見えるようにする
        let leadRacing = 0;
        for (const x of racing.values()) {
          if (x > leadRacing) leadRacing = x;
        }
        const nearFinish = leadRacing > TRACK_LENGTH * 0.78;
        const maxSpan = Math.max(
          140,
          vw * (nearFinish ? 0.88 : 0.68) - 56
        );
        const fitted = fitPackToView(racing, maxSpan);
        positions = new Map([...fitted.positions, ...done]);
        camMinX = fitted.minX;
        camMaxX = fitted.maxX;
      } else {
        positions = done;
        // 全馬ゴール後はゴールライン付近を維持（走り抜けは追わない）
        camMinX = TRACK_LENGTH - vw * 0.35;
        camMaxX = TRACK_LENGTH + 40;
      }

      const targetCam = packCameraTarget(camMinX, camMaxX, vw);
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
