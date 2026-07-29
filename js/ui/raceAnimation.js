window.Keiba = window.Keiba || {};

(function (K) {
  const TRACK_LENGTH = 2400;
  const RUNOUT_LENGTH = 720;
  const LEAD_CAMERA_ANCHOR = 0.4;
  const EVENT_CAMERA_ANCHOR = 0.48;
  const CAMERA_FOLLOW = 3.4;
  const FINISH_CAMERA_ANCHOR = 0.62;
  const PLACE_GAP_SEC = 0.55;
  const MIN_SPEED = 22;
  const CRAWL_SPEED = 6;
  const SAMPLE_DT = 0.08;

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
   * ハプニング込みの前進パス（単調増加）。着順とは独立。
   */
  function buildHappeningPaths(horseIds, stretchStart, events) {
    const baseSpeed = (TRACK_LENGTH * 0.8) / Math.max(1, stretchStart);
    const paths = new Map();

    horseIds.forEach((id) => {
      const points = [{ t: 0, x: 0 }];
      let x = 0;
      for (let t = 0; t < stretchStart; t += SAMPLE_DT) {
        const dt = Math.min(SAMPLE_DT, stretchStart - t);
        const phase = t / stretchStart;
        // 通常の緩急
        let mul = 0.7 + Math.sin(phase * 9 + id * 1.7) * 0.15 + Math.random() * 0.08;
        mul *= K.happeningSpeedMul(events, id, t + dt * 0.5);
        const crawl = mul < 0.15;
        const speed = Math.max(crawl ? CRAWL_SPEED : MIN_SPEED, baseSpeed * mul);
        x += speed * dt;
        points.push({ t: t + dt, x });
      }

      const targetEnd = TRACK_LENGTH * (0.7 + Math.random() * 0.12);
      const scale = targetEnd / Math.max(1, x);
      for (let i = 1; i < points.length; i += 1) {
        points[i].x *= scale;
        const minX =
          points[i - 1].x + CRAWL_SPEED * (points[i].t - points[i - 1].t);
        if (points[i].x < minX) points[i].x = minX;
      }
      paths.set(id, points);
    });

    return paths;
  }

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

  function buildCrowd(el) {
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < 28; i += 1) {
      const p = document.createElement('span');
      p.className = `crowd-person tone-${(i % 5) + 1}`;
      p.style.left = `${(i / 28) * 100}%`;
      p.style.animationDelay = `${(i % 7) * 0.11}s`;
      el.appendChild(p);
    }
  }

  function setCallout(textEl, text, flash) {
    if (!textEl) return;
    textEl.textContent = text;
    if (flash) {
      textEl.classList.remove('pop');
      void textEl.offsetWidth;
      textEl.classList.add('pop');
    }
  }

  function setCrowdMood(crowdEl, mood) {
    if (!crowdEl) return;
    crowdEl.classList.remove('mood-cheer', 'mood-laugh', 'mood-oh', 'mood-scream');
    if (mood) crowdEl.classList.add(`mood-${mood}`);
  }

  function spawnFx(fxLayer, type, worldX, laneIndex) {
    if (!fxLayer) return;
    const el = document.createElement('div');
    el.className = `race-fx fx-${type}`;
    el.style.left = `${worldX}px`;
    const topPct = 30 + ((laneIndex || 0) / 8) * 62;
    el.style.top = `${topPct}%`;

    if (type === 'bait') el.textContent = '🍖';
    else if (type === 'bird') el.textContent = '🐦';
    else if (type === 'splash') el.textContent = '💦';
    else if (type === 'wobble') el.textContent = '💫';
    else if (type === 'flash') el.textContent = '📸';
    else if (type === 'bug') el.textContent = '🐛';
    else if (type === 'slip') el.textContent = '🍌';
    else if (type === 'thunder') el.textContent = '⚡';
    else if (type === 'wind') el.textContent = '💨';
    else if (type === 'sign') el.textContent = '🪧';
    else if (type === 'cat') el.textContent = '🐱';
    else if (type === 'confetti') el.textContent = '🎊';
    else if (type === 'balloon') el.textContent = '🎈';
    else if (type === 'cart') el.textContent = '🌭';
    else el.textContent = '❗';

    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 1600);
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

    const events = K.scheduleRaceHappenings(horseIds, stretchStart);
    const paths = buildHappeningPaths(horseIds, stretchStart, events);

    const stretchStartX = new Map();
    const exitSpeed = new Map();
    horseIds.forEach((id) => {
      const x0 = pathX(paths.get(id), stretchStart);
      stretchStartX.set(id, x0);
      const span = Math.max(0.25, finishTimes[id] - stretchStart);
      exitSpeed.set(id, Math.max(MIN_SPEED, (TRACK_LENGTH - x0) / span));
    });

    const runners = new Map();
    const lanesById = new Map();
    const flagged = new Set();
    const firedEvents = new Set();

    const worldEl = K.$('track-world');
    const bgEl = K.$('track-bg');
    const finishEl = K.$('finish-line');
    const railEl = K.$('lane-rail');
    const markersEl = K.$('distance-markers');
    const fxLayer = K.$('race-fx-layer');
    const crowdEl = K.$('track-crowd');
    const calloutEl = K.$('race-callout-text');
    const flashEl = K.$('race-flash');

    placeDistanceMarkers(markersEl, raceDistance);
    buildCrowd(crowdEl);
    if (fxLayer) fxLayer.innerHTML = '';
    setCallout(
      calloutEl,
      K.START_CALLOUTS[Math.floor(Math.random() * K.START_CALLOUTS.length)],
      true
    );
    setCrowdMood(crowdEl, 'cheer');

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
    let stretchCalled = false;
    let finishCalled = false;
    let eventCamUntil = 0;
    let eventCamHorse = 0;
    const lastNose = new Map();
    const lastFinishAt = Math.max(...Object.values(finishTimes));

    function horseWidth(el) {
      return el.offsetWidth || 54;
    }

    function noseX(id, elapsed) {
      const tFin = finishTimes[id];
      if (elapsed <= 0) return 0;
      if (elapsed < stretchStart) return pathX(paths.get(id), elapsed);
      if (elapsed < tFin) {
        const u = (elapsed - stretchStart) / Math.max(0.001, tFin - stretchStart);
        return lerp(stretchStartX.get(id), TRACK_LENGTH, clamp(u, 0, 1));
      }
      return TRACK_LENGTH + exitSpeed.get(id) * (elapsed - tFin);
    }

    function triggerEvent(ev, positions) {
      setCallout(calloutEl, ev.line, true);
      setCrowdMood(crowdEl, ev.crowd);
      if (ev.fx === 'thunder' || ev.fx === 'flash') {
        if (flashEl) {
          flashEl.className = `race-flash on ${ev.fx}`;
          setTimeout(() => {
            flashEl.className = 'race-flash';
          }, 280);
        }
      }
      const focusId = ev.targets[0];
      const x = positions.get(focusId) || 0;
      spawnFx(fxLayer, ev.fx, x, focusId - 1);
      if (ev.camera) {
        eventCamUntil = ev.start + Math.min(1.1, ev.duration);
        eventCamHorse = focusId;
      }
      ev.targets.forEach((id) => {
        const el = runners.get(id);
        if (!el) return;
        el.classList.remove('haz-bait', 'haz-boost', 'haz-wobble');
        if (ev.type === 'bait' || ev.type === 'cat' || ev.type === 'snackCart') {
          el.classList.add('haz-bait');
        } else if (ev.fx === 'bird' || ev.fx === 'balloon') {
          el.classList.add('haz-boost');
        } else if (ev.fx === 'wobble' || ev.fx === 'slip' || ev.fx === 'shoe') {
          el.classList.add('haz-wobble');
        }
        setTimeout(() => {
          el.classList.remove('haz-bait', 'haz-boost', 'haz-wobble');
        }, ev.duration * 1000);
      });
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

      for (const ev of events) {
        if (firedEvents.has(ev.id)) continue;
        if (elapsed >= ev.start) {
          firedEvents.add(ev.id);
          triggerEvent(ev, positions);
        }
      }

      if (!stretchCalled && elapsed >= stretchStart) {
        stretchCalled = true;
        setCallout(
          calloutEl,
          K.STRETCH_CALLOUTS[Math.floor(Math.random() * K.STRETCH_CALLOUTS.length)],
          true
        );
        setCrowdMood(crowdEl, 'cheer');
      }

      if (!firstHorseFinished && leadNose >= TRACK_LENGTH) {
        firstHorseFinished = true;
        if (!finishCalled) {
          finishCalled = true;
          setCallout(
            calloutEl,
            K.FINISH_CALLOUTS[Math.floor(Math.random() * K.FINISH_CALLOUTS.length)],
            true
          );
          setCrowdMood(crowdEl, 'cheer');
        }
      }

      let targetCam;
      if (elapsed < eventCamUntil && !firstHorseFinished && eventCamHorse) {
        const focusX = positions.get(eventCamHorse) || leadNose;
        targetCam = Math.max(0, focusX - vw * EVENT_CAMERA_ANCHOR);
      } else if (!firstHorseFinished) {
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
