window.Keiba = window.Keiba || {};

(function (K) {
  const FINISH_RATIO = 0.92;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function styleCurve(style, t) {
    switch (style) {
      case '逃げ':
        if (t < 0.25) return easeOutCubic(t / 0.25) * 0.38;
        if (t < 0.7) return 0.38 + ((t - 0.25) / 0.45) * 0.4;
        return 0.78 + ((t - 0.7) / 0.3) * 0.22;
      case '先行':
        if (t < 0.3) return (t / 0.3) * 0.32;
        if (t < 0.75) return 0.32 + ((t - 0.3) / 0.45) * 0.45;
        return 0.77 + ((t - 0.75) / 0.25) * 0.23;
      case '差し':
        if (t < 0.45) return (t / 0.45) * 0.28;
        if (t < 0.75) return 0.28 + ((t - 0.45) / 0.3) * 0.32;
        return 0.6 + easeOutCubic((t - 0.75) / 0.25) * 0.4;
      case '追込':
        if (t < 0.55) return (t / 0.55) * 0.22;
        if (t < 0.78) return 0.22 + ((t - 0.55) / 0.23) * 0.28;
        return 0.5 + easeOutCubic((t - 0.78) / 0.22) * 0.5;
      default:
        return t;
    }
  }

  function assignFinishTimes(finishOrder, duration) {
    const times = {};
    const spread = duration * 0.18;
    finishOrder.forEach((id, place) => {
      times[id] = duration * 0.88 + (place / Math.max(1, finishOrder.length - 1)) * spread;
    });
    return times;
  }

  /**
   * 縦画面用レース演出：下から上へゴール
   * レーンは横並び固定
   */
  K.createRaceAnimation = function createRaceAnimation({
    trackEl,
    lanesEl,
    timerEl,
    finishOrder,
    stylesById,
    onComplete,
  }) {
    const duration =
      K.RACE_DURATION.min +
      Math.random() * (K.RACE_DURATION.max - K.RACE_DURATION.min);

    const finishTimes = assignFinishTimes(finishOrder, duration);
    const runners = new Map();

    lanesEl.innerHTML = '';
    for (let i = 1; i <= 8; i += 1) {
      const lane = document.createElement('div');
      lane.className = 'lane';

      const label = document.createElement('div');
      label.className = `lane-label num-${i}`;
      label.textContent = String(i);
      lane.appendChild(label);

      const horse = K.HORSES.find((h) => h.id === i);
      const runner = document.createElement('div');
      runner.className = `horse-runner num-${i}`;
      runner.textContent = String(i);
      runner.title = horse ? horse.name : '';
      lane.appendChild(runner);

      runners.set(i, runner);
      lanesEl.appendChild(lane);
    }

    const trackHeight = () => trackEl.clientHeight;
    const horseHeight = () => runners.get(1).offsetHeight || 28;

    let raf = 0;
    let start = 0;
    let finished = false;

    /** 下端からの移動量（px）。大きいほど上へ */
    function positionFromBottom(id, elapsed) {
      const finishAt = finishTimes[id];
      const style = stylesById[id] || '先行';
      const maxTravel = trackHeight() * FINISH_RATIO - horseHeight();

      if (elapsed >= finishAt) return maxTravel;

      const t = Math.min(1, elapsed / finishAt);
      const end = Math.max(0.0001, styleCurve(style, 1));
      const norm = styleCurve(style, t) / end;
      return maxTravel * Math.min(1, norm);
    }

    function frame(now) {
      if (!start) start = now;
      const elapsed = (now - start) / 1000;
      if (timerEl) timerEl.textContent = `${elapsed.toFixed(1)}s`;

      for (const [id, el] of runners) {
        el.style.bottom = `${Math.max(0, positionFromBottom(id, elapsed))}px`;
      }

      if (elapsed >= duration * 1.02 && !finished) {
        finished = true;
        const maxTravel = trackHeight() * FINISH_RATIO - horseHeight();
        finishOrder.forEach((id, place) => {
          const el = runners.get(id);
          if (el) el.style.bottom = `${maxTravel - place * 5}px`;
        });
        if (onComplete) onComplete();
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
