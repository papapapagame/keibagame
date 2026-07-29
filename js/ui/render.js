window.Keiba = window.Keiba || {};

(function (K) {
  K.$ = function $(id) {
    return document.getElementById(id);
  };

  K.showScreen = function showScreen(id) {
    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('active', el.id === id);
    });
  };

  K.formatYen = function formatYen(n) {
    return `${Math.floor(n).toLocaleString('ja-JP')}円`;
  };

  K.openModal = function openModal(id) {
    const el = K.$(id);
    if (el) el.hidden = false;
  };

  K.closeModal = function closeModal(id) {
    const el = K.$(id);
    if (el) el.hidden = true;
  };

  K.horseNameById = null;

  function names() {
    if (!K.horseNameById) {
      K.horseNameById = Object.fromEntries(K.HORSES.map((h) => [h.id, h.name]));
    }
    return K.horseNameById;
  }

  const TYPE_CLASS = {
    win: 'tag-win',
    place: 'tag-place',
    quinella: 'tag-quinella',
    exacta: 'tag-exacta',
    trio: 'tag-trio',
    trifecta: 'tag-trifecta',
  };

  K.renderTitleStats = function renderTitleStats(state) {
    const box = K.$('title-stats');
    if (!box) return;
    if (!state.raceCount) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML = `
      <span>所持金 ${K.formatYen(state.money)}</span>
      <span>レース ${state.raceCount}</span>
      <span>的中率 ${K.getHitRate(state).toFixed(1)}%</span>
      <span>回収率 ${K.getRecoveryRate(state).toFixed(1)}%</span>
    `;
  };

  K.renderRaceInfo = function renderRaceInfo(setup, raceCount) {
    const surface = K.$('surface-display');
    surface.textContent = setup.surface;
    surface.classList.toggle('turf', setup.surface === '芝');
    surface.classList.toggle('dirt', setup.surface === 'ダート');
    K.$('distance-display').textContent = `${setup.distance}m`;
    K.$('condition-display').textContent = setup.condition;
    K.$('race-count-display').textContent = `R${raceCount + 1}`;
  };

  K.renderMoney = function renderMoney(money) {
    K.$('money-display').textContent = K.formatYen(money);
  };

  /**
   * 出馬表
   * 単勝/複勝はヘッダタップで切替表示
   */
  K.renderEntryTable = function renderEntryTable({
    setup,
    oddsTable,
    betType,
    oddsMode,
    popularity,
    formation,
    onNameClick,
    onOddsClick,
    onCycleOddsMode,
    onFormationToggle,
    onCycleBetType,
    onSelectAllColumn,
    onClearColumn,
  }) {
    const head = K.$('entry-head');
    const body = K.$('entry-body');
    const foot = K.$('entry-foot');
    const meta = K.BET_TYPES[betType];
    const popularTop = popularity.slice(0, 3);
    const activeCols = meta.activeColumns || 3;
    const totalCols = meta.columns || 3;
    const isWinOdds = oddsMode !== 'place';

    const cycleBtn = K.$('btn-cycle-bet');
    if (cycleBtn) cycleBtn.textContent = meta.label;

    head.innerHTML = '';
    const tr1 = document.createElement('tr');
    tr1.innerHTML = `
      <th class="col-num" rowspan="2">馬番</th>
      <th class="col-name" rowspan="2">馬名</th>
      <th class="col-style" rowspan="2">脚質</th>
      <th class="col-form" rowspan="2">調子</th>
    `;

    const oddsTh = document.createElement('th');
    oddsTh.className = `col-odds${isWinOdds ? '' : ' place-mode'}`;
    oddsTh.rowSpan = 2;
    const oddsHeadBtn = document.createElement('button');
    oddsHeadBtn.type = 'button';
    oddsHeadBtn.className = 'odds-mode-cycle';
    oddsHeadBtn.textContent = isWinOdds ? '単勝' : '複勝';
    oddsHeadBtn.title = 'タップで単勝↔複勝';
    if (onCycleOddsMode) oddsHeadBtn.addEventListener('click', onCycleOddsMode);
    oddsTh.appendChild(oddsHeadBtn);
    tr1.appendChild(oddsTh);

    const groupTh = document.createElement('th');
    groupTh.className = 'col-form-group';
    groupTh.colSpan = totalCols;
    const typeBtn = document.createElement('button');
    typeBtn.type = 'button';
    typeBtn.className = 'bet-type-cycle';
    typeBtn.textContent = meta.label;
    typeBtn.title = 'タップで券種切替';
    if (onCycleBetType) typeBtn.addEventListener('click', onCycleBetType);
    groupTh.appendChild(typeBtn);
    tr1.appendChild(groupTh);
    head.appendChild(tr1);

    const tr2 = document.createElement('tr');
    for (let c = 0; c < totalCols; c += 1) {
      const disabled = c >= activeCols;
      const th = document.createElement('th');
      th.className = `col-form-box${disabled ? ' disabled-col' : ''}`;
      th.textContent = K.FORM_COLUMN_LABELS[c];
      tr2.appendChild(th);
    }
    head.appendChild(tr2);

    body.innerHTML = '';
    for (const horse of K.HORSES) {
      const form = setup.forms[horse.id];
      const tr = document.createElement('tr');
      const oddsValue = isWinOdds
        ? oddsTable.win[horse.id]
        : oddsTable.place[horse.id];
      const isPopular = popularTop.includes(horse.id);

      const numTd = document.createElement('td');
      numTd.innerHTML = `<span class="horse-num num-${horse.id}">${horse.id}</span>`;
      tr.appendChild(numTd);

      const nameTd = document.createElement('td');
      nameTd.className = 'col-name';
      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'horse-name-btn';
      nameBtn.textContent = horse.name;
      nameBtn.addEventListener('click', () => onNameClick(horse));
      nameTd.appendChild(nameBtn);
      tr.appendChild(nameTd);

      const style = setup.styles[horse.id];
      const styleTd = document.createElement('td');
      styleTd.className = 'col-style';
      styleTd.innerHTML = `<span class="style-badge style-${style}">${K.formatStyleShort(style)}</span>`;
      styleTd.title = style || '';
      tr.appendChild(styleTd);

      const formTd = document.createElement('td');
      formTd.className = 'col-form';
      formTd.innerHTML = `<span class="form-stars">${K.formatFormStars(form)}</span>`;
      tr.appendChild(formTd);

      const oddsTd = document.createElement('td');
      oddsTd.className = `col-odds${isWinOdds ? '' : ' place-mode'}`;
      const oddsBtn = document.createElement('button');
      oddsBtn.type = 'button';
      oddsBtn.className = `odds-btn${isWinOdds ? '' : ' place'}${isPopular && isWinOdds ? ' popular' : ''}`;
      oddsBtn.innerHTML = `<span class="odds-val">${oddsValue.toFixed(1)}</span>`;
      oddsBtn.title = isWinOdds ? '単勝を購入' : '複勝を購入';
      oddsBtn.addEventListener('click', () => onOddsClick(horse));
      oddsTd.appendChild(oddsBtn);
      tr.appendChild(oddsTd);

      for (let col = 0; col < totalCols; col += 1) {
        const td = document.createElement('td');
        const disabled = col >= activeCols;
        td.className = `col-form-box${disabled ? ' disabled-col' : ''}`;

        const checked = !disabled && formation
          ? K.isFormationChecked(formation, col, horse.id)
          : false;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `form-cell inline${checked ? ' on' : ''}${disabled ? ' disabled' : ''}`;
        btn.textContent = checked ? '✓' : '';
        btn.disabled = disabled;
        if (!disabled) {
          btn.addEventListener('click', () => onFormationToggle(col, horse.id));
        }
        td.appendChild(btn);
        tr.appendChild(td);
      }

      body.appendChild(tr);
    }

    if (foot) {
      foot.innerHTML = '';
      const footTr = document.createElement('tr');
      const spacer = document.createElement('td');
      spacer.colSpan = 5;
      spacer.className = 'col-actions-spacer';
      spacer.textContent = '列操作';
      footTr.appendChild(spacer);

      for (let col = 0; col < totalCols; col += 1) {
        const disabled = col >= activeCols;
        const td = document.createElement('td');
        td.className = `col-form-box col-actions-cell${disabled ? ' disabled-col' : ''}`;

        const wrap = document.createElement('div');
        wrap.className = 'col-actions';

        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'col-action-btn';
        allBtn.textContent = '全選択';
        allBtn.disabled = disabled;
        if (!disabled && onSelectAllColumn) {
          allBtn.addEventListener('click', () => onSelectAllColumn(col));
        }

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'col-action-btn clear';
        clearBtn.textContent = 'クリア';
        clearBtn.disabled = disabled;
        if (!disabled && onClearColumn) {
          clearBtn.addEventListener('click', () => onClearColumn(col));
        }

        wrap.appendChild(allBtn);
        wrap.appendChild(clearBtn);
        td.appendChild(wrap);
        footTr.appendChild(td);
      }
      foot.appendChild(footTr);
    }
  };

  /**
   * 下部パネル切替：チェック有無でオーバーレイ表示
   */
  K.updateBottomPanels = function updateBottomPanels({
    showSelection,
    betType,
    picksList,
    oddsTable,
    bets,
    unitAmount,
    onBuyOne,
    onBuyAll,
    onDeleteBet,
  }) {
    const purchased = K.$('panel-purchased');
    const selection = K.$('panel-selection');

    if (showSelection) {
      purchased.hidden = true;
      selection.hidden = false;
      K.renderSelectionPanel({
        betType,
        picksList,
        oddsTable,
        unitAmount,
        onBuyOne,
        onBuyAll,
      });
    } else {
      selection.hidden = true;
      purchased.hidden = false;
      K.renderPurchasedPanel({ bets, onDeleteBet });
    }
  };

  K.renderSelectionPanel = function renderSelectionPanel({
    betType,
    picksList,
    oddsTable,
    unitAmount,
    onBuyOne,
    onBuyAll,
  }) {
    const meta = K.BET_TYPES[betType];
    K.$('selection-title').textContent = meta.label;

    const buyAll = K.$('btn-buy-all');
    buyAll.textContent = `すべて購入（${picksList.length}件）`;
    buyAll.disabled = picksList.length === 0;
    buyAll.onclick = () => onBuyAll();

    const list = K.$('combo-list');
    list.innerHTML = '';

    if (!picksList.length) {
      const li = document.createElement('li');
      li.className = 'combo-empty';
      li.textContent = '組み合わせがまだありません';
      list.appendChild(li);
      return;
    }

    picksList.forEach((picks, index) => {
      const odds = K.getOdds(oddsTable, betType, picks);
      const li = document.createElement('li');
      li.className = 'combo-row';
      li.innerHTML = `
        <span class="combo-picks">${K.formatComboText(picks)}</span>
        <span class="combo-odds">${odds.toFixed(1)}倍</span>
      `;
      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = 'btn-outline-red';
      buyBtn.textContent = `購入（${unitAmount}円）`;
      buyBtn.addEventListener('click', () => onBuyOne(picks, index));
      li.appendChild(buyBtn);
      list.appendChild(li);
    });
  };

  K.renderPurchasedPanel = function renderPurchasedPanel({ bets, onDeleteBet }) {
    const list = K.$('bet-list');
    list.innerHTML = '';
    let total = 0;

    if (!bets.length) {
      const li = document.createElement('li');
      li.className = 'combo-empty';
      li.textContent = 'まだ購入がありません';
      list.appendChild(li);
    } else {
      bets.forEach((bet) => {
        total += bet.amount;
        const li = document.createElement('li');
        li.className = 'purchased-row';
        const mark = K.BET_TYPES[bet.type].ordered ? '-' : '-';
        const picksText = bet.picks.join(mark);
        li.innerHTML = `
          <span class="bet-type-tag ${TYPE_CLASS[bet.type] || ''}">${K.BET_TYPES[bet.type].label}</span>
          <span class="purchased-picks">${picksText}</span>
          <span class="purchased-amount">${bet.amount}円</span>
        `;
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-outline-red';
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', () => onDeleteBet(bet.id));
        li.appendChild(delBtn);
        list.appendChild(li);
      });
    }

    K.$('total-bet').textContent = `${total.toLocaleString('ja-JP')}円`;
    return total;
  };

  K.renderAbilityModal = function renderAbilityModal(horse) {
    K.$('ability-horse-name').textContent = `${horse.id}. ${horse.name}`;
    const body = K.$('ability-body');
    body.innerHTML = '';
    for (const item of K.ABILITY_LABELS) {
      const val = horse[item.key];
      const row = document.createElement('div');
      row.className = 'ability-row';
      const pct = Math.min(100, (val / 100) * 100);
      row.innerHTML = `
        <div class="label-row"><span>${item.label}</span><strong>${val}</strong></div>
        <div class="bar"><span style="width:${pct}%"></span></div>
      `;
      body.appendChild(row);
    }
    K.openModal('ability-modal');
  };

  K.renderResult = function renderResult({
    finishOrder,
    settled,
    payoutTotal,
    money,
    oddsTable,
  }) {
    const orderEl = K.$('result-order');
    orderEl.innerHTML = '';
    finishOrder.forEach((id, idx) => {
      const horse = K.HORSES.find((h) => h.id === id);
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="place">${idx + 1}</span>
        <span class="horse-num num-${id}">${id}</span>
        <span class="result-horse-name">${horse.name}</span>
      `;
      orderEl.appendChild(li);
    });

    const oddsEl = K.$('result-odds');
    oddsEl.innerHTML = '';
    const a = finishOrder[0];
    const b = finishOrder[1];
    const c = finishOrder[2];
    const quinella = [a, b].sort((x, y) => x - y);
    const trio = [a, b, c].sort((x, y) => x - y);

    const rows = [
      { label: '単勝', items: [`${a}　${oddsTable.win[a].toFixed(1)}`] },
      {
        label: '複勝',
        items: [a, b, c].map((id, i) =>
          `${i + 1}着 ${id}　${oddsTable.place[id].toFixed(1)}`
        ),
      },
      {
        label: '馬連',
        items: [`${quinella[0]}-${quinella[1]}　${oddsTable.quinella[quinella.join('-')].toFixed(1)}`],
      },
      {
        label: '馬単',
        items: [`${a}-${b}　${oddsTable.exacta[`${a}-${b}`].toFixed(1)}`],
      },
      {
        label: '三連複',
        items: [`${trio[0]}-${trio[1]}-${trio[2]}　${oddsTable.trio[trio.join('-')].toFixed(1)}`],
      },
      {
        label: '三連単',
        items: [`${a}-${b}-${c}　${oddsTable.trifecta[`${a}-${b}-${c}`].toFixed(1)}`],
      },
    ];

    for (const row of rows) {
      const block = document.createElement('div');
      block.className = 'odds-result-block';
      const title = document.createElement('div');
      title.className = 'odds-result-label';
      title.textContent = row.label;
      block.appendChild(title);
      for (const text of row.items) {
        const line = document.createElement('div');
        line.className = 'odds-result-line';
        line.textContent = text;
        block.appendChild(line);
      }
      oddsEl.appendChild(block);
    }

    const payoutList = K.$('payout-list');
    payoutList.innerHTML = '';
    if (!settled.length) {
      const li = document.createElement('li');
      li.className = 'miss';
      li.textContent = '購入馬券なし';
      payoutList.appendChild(li);
    } else {
      for (const s of settled) {
        const li = document.createElement('li');
        li.className = s.hit ? 'hit' : 'miss';
        const label = K.formatBetLabel(s.bet.type, s.bet.picks, names());
        li.innerHTML = s.hit
          ? `<span>${label}</span><span>${K.formatYen(s.payout)}</span>`
          : `<span>${label}</span><span>不的中</span>`;
        payoutList.appendChild(li);
      }
    }

    K.$('payout-total').textContent = K.formatYen(payoutTotal);
    K.$('money-after').textContent = K.formatYen(money);
  };
})(window.Keiba);
