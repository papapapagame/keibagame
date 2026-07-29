window.Keiba = window.Keiba || {};

(function (K) {
  /** 仮想コース長（鼻先座標。ゴール線 = TRACK_LENGTH） */
  const TRACK_LENGTH = 2400;
  const RUNOUT_LENGTH = 720;
  /** 現在先頭を画面のどこに置くか */
  const LEAD_CAMERA_ANCHOR = 0.4;
  const CAMERA_FOLLOW = 3.2;
  const FINISH_CAMERA_ANCHOR = 0.62;
  /** 着差（秒） */
  const PLACE_GAP_SEC = 0.55;
  /** 道中の馬間（ワールド座標） */
  const PACK_GAP = 48;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
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
   * 道中用のランダム順位キーフレーム。
   * 着順とは無関係。パターン（独走気味／大荒れ／中団入れ替わり）も毎回ランダム。
   */
  function buildDramaFrames(horseIds, stretchStart) {
    const ids = horseIds.slice();
    const patternRoll = Math.random();
    const pattern =
      patternRoll < 0.28 ? 'holdLead' : patternRoll < 0.55 ? 'lateSurge' : 'chaos';

    let stickyLead = ids[Math.floor(Math.random() * ids.length)];
    let surgeId = ids[Math.floor(Math.random() * ids.length)];
    if (surgeId === stickyLead && ids.length > 1) {
      surgeId = ids[(ids.indexOf(surgeId) + 1) % ids.length];
    }

    const times = [0];
    let t = 0.8 + Math.random() * 1.2;
    while (t < stretchStart - 0.6) {
      times.push(t);
      t += 1.2 + Math.random() * 2.4;
    }
    times.push(stretchStart);

    const frames = times.map((time, index) => {
      const order = shuffleInPlace(ids.slice());
      const phase = times.length <= 1 ? 0 : index / (times.length - 1);

      if (pattern === 'holdLead') {
        // 序盤〜中盤は同じ馬が前目、終盤キーフレームでは崩す
        if (phase < 0.7) {
          const rest = order.filter((id) => id !== stickyLead);
          order.length = 0;
          order.push(stickyLead, ...rest);
          // 2番手付近も軽く入れ替え
          if (rest.length > 2 && Math.random() < 0.7) {
            const a = 1 + Math.floor(Math.random() * Math.min(3, rest.length));
            const b = 1 + Math.floor(Math.random() * Math.min(3, rest.length));
            const tmp = order[a];
            order[a] = order[b];
            order[b] = tmp;
          }
        }
      } else if (pattern === 'lateSurge') {
        if (phase < 0.45) {
          // 終盤ごぼう抜き役を後ろ〜中団に置く
          const rest = order.filter((id) => id !== surgeId);
          const back = Math.min(rest.length, 4 + Math.floor(Math.random() * 3));
          order.length = 0;
          order.push(...rest.slice(0, back), surgeId, ...rest.slice(back));
        } else if (phase < 0.85) {
          const rest = order.filter((id) => id !== surgeId);
          order.length = 0;
          order.push(surgeId, ...shuffleInPlace(rest));
        }
      }
      // chaos: 完全シャッフルのまま

      const rankById = {};
      order.forEach((id, rank) => {
        rankById[id] = rank;
      });
      return { time, rankById };
    });

    return { frames, pattern };
  }

  function dramaRank(id, elapsed, frames) {
    if (!frames.length) return 0;
    if (elapsed <= frames[0].time) return frames[0].rankById[id] || 0;
    for (let i = 1; i < frames.length; i += 1) {
      const prev = frames[i - 1];
      const next = frames[i];
      if (elapsed <= next.time) {
        const t = easeInOut(
          (elapsed - prev.time) / Math.max(0.001, next.time - prev.time)
        );
        return lerp(prev.rankById[id] || 0, next.rankById[id] || 0, t);
      }
    }
    const last = frames[frames.length - 1];
    return last.rankById[id] || 0;
  }

  function fieldProgress(elapsed, stretchStart) {
    const u = clamp(elapsed / stretchStart, 0, 1);
    // 直線手前まで。ゴールはストレッチで各馬が到達
    return TRACK_LENGTH * 0.86 * (0.7 * u + 0.3 * u * u);
  }

  function dramaNoseX(id, elapsed, frames, stretchStart) {
    const field = fieldProgress(elapsed, stretchStart);
    const rank = dramaRank(id, elapsed, frames);
    return field - rank * PACK_GAP;
  }

  function fitPackAroundLead(positions, maxSpan) {
    let minX = Infinity;
    let maxX = -Infinity;
    let leadId = null;
    for (const [id, x] of positions) {
      if (x < minX) minX = x;
      if (x > maxX) {
        maxX = x;
        leadId = id;
      }
    }
    const span = maxX - minX;
    if (span <= maxSpan || span < 1e-6 || leadId == null) {
      return { positions, minX, maxX, leadId };
    }
    const scale = maxSpan / span;
    const fitted = new Map();
    for (const [id, x] of positions) {
      fitted.set(id, maxX - (maxX - x) * scale);
    }
    return {
      positions: fitted,
      minX: maxX - maxSpan,
      maxX,
      leadId,
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
    const drama = buildDramaFrames(horseIds, stretchStart);
    const stretchStartX = new Map();
    horseIds.forEach((id) => {
      stretchStartX.set(
        id,
        dramaNoseX(id, stretchStart, drama.frames, stretchStart)
      );
    });

    const exitSpeed = new Map();
    horseIds.forEach((id) => {
      const tFin = finishTimes[id];
      const startX = stretchStartX.get(id);
      const span = Math.max(0.2, tFin - stretchStart);
      exitSpeed.set(id, (TRACK_LENGTH - startX) / span);
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

    function viewWidth() {
      return trackEl.clientWidth || 1;
    }

    function horseWidth(el) {
      return el.offsetWidth || 54;
    }

    function noseX(id, elapsed) {
      const tFin = finishTimes[id];
      if (elapsed <= 0) return 0;
      if (elapsed < stretchStart) {
        return dramaNoseX(id, elapsed, drama.frames, stretchStart);
      }
      if (elapsed < tFin) {
        const u = (elapsed - stretchStart) / Math.max(0.001, tFin - stretchStart);
        // 終端で急停止しないよう、ほぼ線形でゴールへ
        return lerp(stretchStartX.get(id), TRACK_LENGTH, clamp(u, 0, 1));
      }
      const speed = exitSpeed.get(id) || 80;
      return TRACK_LENGTH + speed * (elapsed - tFin);
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
      const racing = new Map();
      const done = new Map();

      for (const id of runners.keys()) {
        const x = noseX(id, elapsed);
        raw.set(id, x);
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

      if (!firstHorseFinished && done.size > 0) {
        firstHorseFinished = true;
      }

      let positions;
      let leadNose = 0;

      if (racing.size > 0) {
        const maxSpan = Math.max(150, vw * 0.78 - 56);
        const fitted = fitPackAroundLead(racing, maxSpan);
        positions = new Map([...fitted.positions, ...done]);
        leadNose = fitted.maxX;
      } else {
        positions = done;
        leadNose = TRACK_LENGTH;
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
