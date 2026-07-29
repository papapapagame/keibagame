/**
 * ドタバタ競馬ハプニング定義・スケジュール生成
 */
window.Keiba = window.Keiba || {};

(function (K) {
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function horseName(id) {
    const h = K.HORSES.find((x) => x.id === id);
    return h ? h.name : `${id}番`;
  }

  function call(id, lines) {
    const name = horseName(id);
    const n = `${id}番`;
    return pick(lines).replace(/\{name\}/g, name).replace(/\{n\}/g, n);
  }

  /** ハプニングカタログ（盛り上がり・ドタバタ優先） */
  const CATALOG = [
    {
      id: 'bait',
      weight: 1.2,
      scope: 'single',
      duration: [1.1, 1.6],
      speedMul: 0.07,
      crawl: true,
      fx: 'bait',
      camera: true,
      crowd: 'laugh',
      lines: [
        'あっ！{n}{name}、落ちてる餌に食いついたー！',
        '{n}が完全にランチタイム！止まってます！',
        '餌に夢中の{n}！レースを忘れています！',
      ],
    },
    {
      id: 'bird',
      weight: 1.3,
      scope: 'single',
      duration: [0.7, 1.1],
      speedMul: 2.35,
      fx: 'bird',
      camera: true,
      crowd: 'cheer',
      lines: [
        '鳥だー！{n}{name}が驚いて爆加速！',
        '後ろからカラス！{n}がパニックダッシュ！',
        '{n}、鳥に追われて信じられない伸び！',
      ],
    },
    {
      id: 'puddle',
      weight: 1.0,
      scope: 'single',
      duration: [1.2, 1.6],
      // 前後半で mul 切替は schedule 側で phases に分解
      phases: [
        { at: 0, mul: 0.32 },
        { at: 0.55, mul: 1.55 },
      ],
      fx: 'splash',
      camera: true,
      crowd: 'oh',
      lines: [
        '{n}、水たまり直撃！ビショビショです！',
        'バシャーン！{n}が水しぶきを上げた！',
      ],
    },
    {
      id: 'shoe',
      weight: 0.9,
      scope: 'single',
      duration: [0.9, 1.3],
      speedMul: 0.38,
      fx: 'wobble',
      camera: true,
      crowd: 'oh',
      lines: [
        '{n}の脚元がヨロヨロ！靴が飛んだ！？',
        '{n}{name}、バランス崩壊！ふらふら走ってます！',
      ],
    },
    {
      id: 'photo',
      weight: 0.8,
      scope: 'single',
      duration: [0.5, 0.8],
      speedMul: 0.42,
      fx: 'flash',
      camera: true,
      crowd: 'cheer',
      lines: [
        '{n}がカメラ目線！今じゃない！',
        'ポーズ！？{n}、観客に手を振って減速！',
      ],
    },
    {
      id: 'bug',
      weight: 0.85,
      scope: 'single',
      duration: [0.7, 1.0],
      speedMul: 0.5,
      fx: 'bug',
      camera: true,
      crowd: 'laugh',
      lines: [
        '{n}の鼻先に虫！シェイクしてます！',
        'ムシ！{n}が激しく首を振った！',
      ],
    },
    {
      id: 'banana',
      weight: 0.75,
      scope: 'single',
      duration: [0.8, 1.2],
      speedMul: 0.25,
      fx: 'slip',
      camera: true,
      crowd: 'laugh',
      lines: [
        'バナナの皮ー！{n}がスリップ！',
        '{n}、転びそう…！持ちこたえた！',
      ],
    },
    {
      id: 'thunder',
      weight: 0.7,
      scope: 'all',
      duration: [1.0, 1.4],
      phases: [
        { at: 0, mul: 0.18 },
        { at: 0.28, mul: 1.65 },
      ],
      fx: 'thunder',
      camera: false,
      crowd: 'scream',
      lines: [
        'ドカーン！雷！！みんな驚いてます！',
        '突然の雷光！フィールドが大パニック！',
      ],
    },
    {
      id: 'wind',
      weight: 0.75,
      scope: 'lead',
      duration: [0.9, 1.3],
      speedMul: 0.4,
      othersMul: 1.25,
      fx: 'wind',
      camera: true,
      crowd: 'oh',
      lines: [
        '突風ー！先頭が押し戻される！中団襲来！',
        '強風！先頭勢が失速、後ろが詰めた！',
      ],
    },
    {
      id: 'sign',
      weight: 0.7,
      scope: 'multi',
      multi: [2, 3],
      duration: [0.8, 1.2],
      speedMul: 0.28,
      fx: 'sign',
      camera: true,
      crowd: 'oh',
      lines: [
        '看板が倒れたー！回避する馬と突っ込む馬！',
        'コース上に障害物！大ドタバタ！',
      ],
    },
    {
      id: 'cat',
      weight: 0.85,
      scope: 'multi',
      multi: [2, 4],
      duration: [0.9, 1.3],
      speedMul: 0.12,
      fx: 'cat',
      camera: true,
      crowd: 'laugh',
      lines: [
        '猫が横断ー！急ブレーキ祭り！',
        'にゃんこ登場！馬たちが急停止ムード！',
      ],
    },
    {
      id: 'confetti',
      weight: 0.65,
      scope: 'all',
      duration: [1.3, 1.8],
      phases: [
        { at: 0, mul: 0.55 },
        { at: 0.6, mul: 1.35 },
      ],
      fx: 'confetti',
      camera: false,
      crowd: 'cheer',
      lines: [
        '紙吹雪で視界ゼロ！ペースダウン！',
        '祝福が早すぎる！紙吹雪で大混乱！',
      ],
    },
    {
      id: 'balloon',
      weight: 0.7,
      scope: 'single',
      duration: [0.8, 1.2],
      speedMul: 1.9,
      fx: 'balloon',
      camera: true,
      crowd: 'cheer',
      lines: [
        '風船が顔に！{n}が怒りの加速！',
        '{n}、風船にビビってスパート！',
      ],
    },
    {
      id: 'snackCart',
      weight: 0.55,
      scope: 'multi',
      multi: [3, 5],
      duration: [1.0, 1.5],
      speedMul: 0.2,
      fx: 'cart',
      camera: true,
      crowd: 'laugh',
      lines: [
        '売店のカートが侵入！おやつ騒動！',
        'ホットドッグの香り…複数馬がフラフラ！',
      ],
    },
  ];

  function weightedPickCatalog() {
    const total = CATALOG.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of CATALOG) {
      r -= e.weight;
      if (r <= 0) return e;
    }
    return CATALOG[CATALOG.length - 1];
  }

  function resolveTargets(def, horseIds, leadIdGuess) {
    if (def.scope === 'all') return horseIds.slice();
    if (def.scope === 'single') return [pick(horseIds)];
    if (def.scope === 'lead') return [leadIdGuess || pick(horseIds)];
    if (def.scope === 'multi') {
      const [lo, hi] = def.multi || [2, 3];
      const n = lo + Math.floor(Math.random() * (hi - lo + 1));
      return shuffle(horseIds).slice(0, Math.min(n, horseIds.length));
    }
    return [pick(horseIds)];
  }

  /**
   * @returns {Array<{id,type,start,end,targets,mulAt,line,fx,camera,crowd}>}
   */
  K.scheduleRaceHappenings = function scheduleRaceHappenings(horseIds, stretchStart) {
    const events = [];
    const usedTypes = new Set();
    const busyUntil = {};
    horseIds.forEach((id) => {
      busyUntil[id] = 0;
    });

    const smallCount = 3 + Math.floor(Math.random() * 3); // 3-5
    const midCount = 1 + (Math.random() < 0.65 ? 1 : 0); // 1-2
    const total = smallCount + midCount;

    let t = 1.2 + Math.random() * 1.5;
    const latest = stretchStart * 0.92;

    for (let i = 0; i < total && t < latest - 1.2; i += 1) {
      let def = weightedPickCatalog();
      let guard = 0;
      while (usedTypes.has(def.id) && guard < 8) {
        def = weightedPickCatalog();
        guard += 1;
      }
      // 大〜中は後半寄りに寄せる
      const isBig = def.scope === 'all' || def.id === 'cat' || def.id === 'snackCart';
      if (isBig && t < stretchStart * 0.35) {
        t = stretchStart * (0.4 + Math.random() * 0.2);
      }

      const durRange = def.duration || [0.8, 1.2];
      const duration =
        durRange[0] + Math.random() * (durRange[1] - durRange[0]);
      const start = t;
      const end = start + duration;

      const leadGuess = pick(horseIds);
      let targets = resolveTargets(def, horseIds, leadGuess);
      // クールダウン中の馬を避ける
      targets = targets.filter((id) => busyUntil[id] <= start + 0.05);
      if (!targets.length && def.scope === 'single') {
        const free = horseIds.filter((id) => busyUntil[id] <= start);
        if (!free.length) {
          t += 1.2 + Math.random();
          continue;
        }
        targets = [pick(free)];
      }
      if (!targets.length) {
        t += 1.0 + Math.random();
        continue;
      }

      targets.forEach((id) => {
        busyUntil[id] = end + 0.4;
      });
      usedTypes.add(def.id);

      const primary = targets[0];
      const line = def.lines[0].includes('{')
        ? call(primary, def.lines)
        : pick(def.lines);

      const mulAt = (localT) => {
        const u = clamp01(localT / duration);
        if (def.phases && def.phases.length) {
          let mul = def.phases[0].mul;
          for (const ph of def.phases) {
            if (u >= ph.at) mul = ph.mul;
          }
          return mul;
        }
        return def.speedMul != null ? def.speedMul : 1;
      };

      events.push({
        id: `${def.id}-${i}`,
        type: def.id,
        start,
        end,
        duration,
        targets: targets.slice(),
        othersMul: def.othersMul || 1,
        affectOthers: def.scope === 'lead',
        mulAt,
        line,
        fx: def.fx,
        camera: !!def.camera,
        crowd: def.crowd || 'cheer',
      });

      t = end + 0.7 + Math.random() * 1.6;
    }

    events.sort((a, b) => a.start - b.start);
    return events;
  };

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  K.happeningSpeedMul = function happeningSpeedMul(events, horseId, elapsed) {
    let mul = 1;
    for (const ev of events) {
      if (elapsed < ev.start || elapsed > ev.end) continue;
      const local = elapsed - ev.start;
      if (ev.targets.includes(horseId)) {
        mul *= ev.mulAt(local);
      } else if (ev.affectOthers) {
        mul *= ev.othersMul;
      }
    }
    return mul;
  };

  K.START_CALLOUTS = [
    'ゲートオープン！ドタバタ競馬、始まりました！',
    'スタートです！今日も何か起きそうな空気…！',
    '出走ー！平和なレースになるとは思えない！',
  ];

  K.STRETCH_CALLOUTS = [
    '直線入場！まだ何が起きるか分からない！',
    'ゴールまであと少し！波乱の匂いがします！',
    '最終盤！先頭は誰だー！',
  ];

  K.FINISH_CALLOUTS = [
    'ゴールイン！この決着、納得できますか！？',
    '到着ー！ハプニングだらけのレースでした！',
    '勝負あり！ドタバタの末の着順です！',
  ];
})(window.Keiba);
