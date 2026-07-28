window.Keiba = window.Keiba || {};

(function (K) {
  /** 仮想コース長（ワールド座標） */
  const TRACK_LENGTH = 2400;
  /** 先頭馬を画面左から何割の位置に置くか */
  const CAMERA_ANCHOR = 0.38;
  /** カメラ追従のなめらかさ */
  const CAMERA_FOLLOW = 3.0;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function smootherstep(t) {
    t = clamp(t, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
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

  /** 脚質ペース（端点固定・連続） */
  function styleWarp(style, u) {
    switch (style) {
      case '逃げ':
        return cubicBezierEase(u, 0.18, 0.42, 0.48, 0.82);
      case '先行':
        return cubicBezierEase(u, 0.30, 0.34, 0.55, 0.70);
      case '差し':
        return cubicBezierEase(u, 0.42, 0.20, 0.60, 0.88);
      case '追込':
        return cubicBezierEase(u, 0.52, 0.10, 0.70, 0.92);
      default:
        return smootherstep(u);
    }
  }

  function assignFinishTimes(finishOrder, duration) {
    const times = {};
    // 先頭は終盤でゴール、着差は短めにして最後まで流れを保つ
    const firstAt = duration * 0.93;
    const spread = duration * 0.055;
    const n = Math.max(1, finishOrder.length - 1);
    finishOrder.forEach((id, place) => {
      times[id] = firstAt + (place / n) * spread;
    });
    return times;
  }

  function worldProgress(id, elapsed, finishTimes, stylesById) {
    const finishAt = finishTimes[id];
    const style = stylesById[id] || '先行';
    if (elapsed <= 0) return 0;
    if (elapsed >= finishAt) return TRACK_LENGTH;
    const u = elapsed / finishAt;
    return TRACK_LENGTH * smootherstep(styleWarp(style, u));
  }

  /** 残り距離看板のメートル値（ゴール手前まで） */
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
    const runners = new Map();
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
      lanesEl.appendChild(lane);
    }

    if (finishEl) finishEl.style.left = `${TRACK_LENGTH}px`;
    if (worldEl) worldEl.style.width = `${TRACK_LENGTH + 480}px`;

    let raf = 0;
    let start = 0;
    let lastNow = 0;
    let cameraX = 0;
    let finished = false;
    const lastFinishAt = Math.max(...Object.values(finishTimes));

    function viewWidth() {
      return trackEl.clientWidth || 1;
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

      let leadX = 0;
      const positions = new Map();
      for (const id of runners.keys()) {
        const x = worldProgress(id, elapsed, finishTimes, stylesById);
        positions.set(id, x);
        if (x > leadX) leadX = x;
      }

      // 先頭到達後もゴール板が画面内に入るよう、カメラ目標を少し先へ寄せる
      const camFocus = Math.max(leadX, Math.min(TRACK_LENGTH, leadX + 40));
      const targetCam = Math.max(0, camFocus - viewWidth() * CAMERA_ANCHOR);
      const follow = 1 - Math.exp(-CAMERA_FOLLOW * dt);
      cameraX += (targetCam - cameraX) * follow;

      if (worldEl) {
        worldEl.style.transform = `translate3d(${-cameraX}px, 0, 0)`;
      }
      if (bgEl) {
        bgEl.style.backgroundPosition = `${-cameraX * 0.4}px 0, ${-cameraX * 0.7}px 0`;
      }

      for (const [id, el] of runners) {
        const x = positions.get(id);
        el.style.transform = `translate3d(${x}px, -50%, 0)`;
        el.style.zIndex = String(10 + Math.floor(x / 8));
      }

      if (elapsed >= lastFinishAt + 0.85 && !finished) {
        finished = true;
        if (onComplete) setTimeout(() => onComplete(), 400);
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
