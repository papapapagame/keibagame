window.Keiba = window.Keiba || {};

(function (K) {
  function sortedKey(nums) {
    return [...nums].sort((a, b) => a - b).join('-');
  }

  /** 空のフォーメーション（常に3列） */
  K.createEmptyFormation = function createEmptyFormation(betType) {
    const meta = K.BET_TYPES[betType];
    if (!meta || meta.formation !== 'matrix') return null;
    const cols = meta.columns || 3;
    return {
      mode: 'matrix',
      rows: Array.from({ length: cols }, () => []),
    };
  };

  /**
   * 列ごとの掛け合わせで買い目を展開
   * 馬連: 列1×列2（順不同、同一馬除外）→ 1-2, 1-3 など（同列同士は作らない）
   * 馬単: 列1→列2（着順どおり）
   * 三連複: 列1×列2×列3（順不同・重複排除）
   * 三連単: 列1→列2→列3（着順どおり）
   */
  K.expandFormation = function expandFormation(betType, formation) {
    if (!formation || formation.mode !== 'matrix') return [];
    const meta = K.BET_TYPES[betType];
    const active = meta.activeColumns || meta.picks;
    const cols = formation.rows
      .slice(0, active)
      .map((r) => [...r].sort((a, b) => a - b));

    if (cols.some((c) => c.length === 0)) return [];

    if (betType === 'quinella') {
      const out = [];
      const seen = new Set();
      for (const a of cols[0]) {
        for (const b of cols[1]) {
          if (a === b) continue;
          const picks = a < b ? [a, b] : [b, a];
          const key = picks.join('-');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(picks);
        }
      }
      return out;
    }

    if (betType === 'exacta') {
      const out = [];
      for (const a of cols[0]) {
        for (const b of cols[1]) {
          if (a === b) continue;
          out.push([a, b]);
        }
      }
      return out;
    }

    if (betType === 'trio') {
      const out = [];
      const seen = new Set();
      for (const a of cols[0]) {
        for (const b of cols[1]) {
          if (b === a) continue;
          for (const c of cols[2]) {
            if (c === a || c === b) continue;
            const picks = [a, b, c].sort((x, y) => x - y);
            const key = picks.join('-');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(picks);
          }
        }
      }
      return out;
    }

    if (betType === 'trifecta') {
      const out = [];
      for (const a of cols[0]) {
        for (const b of cols[1]) {
          if (b === a) continue;
          for (const c of cols[2]) {
            if (c === a || c === b) continue;
            out.push([a, b, c]);
          }
        }
      }
      return out;
    }

    return [];
  };

  K.toggleFormationCell = function toggleFormationCell(formation, colIndex, horseId) {
    if (!formation || formation.mode !== 'matrix') return formation;
    const col = formation.rows[colIndex];
    if (!col) return formation;
    const idx = col.indexOf(horseId);
    if (idx >= 0) col.splice(idx, 1);
    else col.push(horseId);
    col.sort((a, b) => a - b);
    return formation;
  };

  K.isFormationChecked = function isFormationChecked(formation, colIndex, horseId) {
    if (!formation || formation.mode !== 'matrix') return false;
    return !!(formation.rows[colIndex] && formation.rows[colIndex].includes(horseId));
  };

  /** チェックが1つ以上あるか（パネル切替用） */
  K.hasFormationSelection = function hasFormationSelection(formation) {
    if (!formation || !formation.rows) return false;
    return formation.rows.some((col) => col.length > 0);
  };

  K.formatComboText = function formatComboText(picks) {
    return picks.join('-');
  };

  // 互換用
  K.sortedKey = sortedKey;
})(window.Keiba);
