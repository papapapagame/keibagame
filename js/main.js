/**
 * 競馬ゲーム メイン
 */
(function () {
  const K = window.Keiba;
  K.assertAbilityTotals();

  let state = K.loadSave();
  let race = null;
  let oddsTable = null;
  let bets = [];
  let betType = 'quinella';
  let formation = null;
  let raceAnim = null;

  const UNIT = () => K.FORM_UNIT || 100;

  function refreshPurchaseUI() {
    if (!race || !oddsTable) return;

    if (!formation) {
      formation = K.createEmptyFormation(betType);
    }

    K.renderMoney(state.money);
    K.renderRaceInfo(race.setup, state.raceCount);
    K.renderEntryTable({
      setup: race.setup,
      oddsTable,
      betType,
      popularity: race.popularity,
      formation,
      onNameClick: (horse) => K.renderAbilityModal(horse),
      onWinOddsClick: (horse) => tryAddBets('win', [[horse.id]]),
      onPlaceOddsClick: (horse) => tryAddBets('place', [[horse.id]]),
      onFormationToggle: onFormationToggle,
      onCycleBetType: cycleBetType,
      onSelectAllColumn: (col) => {
        K.selectAllFormationColumn(formation, col);
        refreshPurchaseUI();
      },
      onClearColumn: (col) => {
        K.clearFormationColumn(formation, col);
        refreshPurchaseUI();
      },
    });

    const picksList = K.expandFormation(betType, formation);
    const showSelection = K.hasFormationSelection(formation);

    K.updateBottomPanels({
      showSelection,
      betType,
      picksList,
      oddsTable,
      bets,
      unitAmount: UNIT(),
      onBuyOne: buyOneCombo,
      onBuyAll: buyAllCombos,
      onDeleteBet: deleteBet,
    });

    K.$('btn-cancel-bets').disabled = bets.length === 0;
  }

  function resetFormation() {
    formation = K.createEmptyFormation(betType);
  }

  function cycleBetType() {
    const order = K.FORM_TAB_TYPES;
    const idx = order.indexOf(betType);
    betType = order[(idx + 1) % order.length];
    resetFormation();
    refreshPurchaseUI();
  }

  function startNewRace() {
    if (state.money < UNIT()) {
      state.money = K.INITIAL_MONEY;
      K.saveState(state);
    }
    bets = [];
    betType = 'quinella';
    formation = K.createEmptyFormation(betType);
    const setup = K.generateRaceSetup();
    race = K.prepareRace(setup);
    oddsTable = K.buildOddsTable(race.winRates);
    refreshPurchaseUI();
    K.showScreen('screen-purchase');
  }

  function onFormationToggle(colIndex, horseId) {
    const meta = K.BET_TYPES[betType];
    if (!formation || colIndex >= (meta.activeColumns || 3)) return;
    K.toggleFormationCell(formation, colIndex, horseId);
    refreshPurchaseUI();
  }

  function canAfford(extra) {
    const total = bets.reduce((s, b) => s + b.amount, 0) + extra;
    return total <= state.money;
  }

  function showMoneyError() {
    K.$('bet-confirm-yes').hidden = true;
    K.$('bet-confirm-message').textContent = '所持金が不足しています';
    K.openModal('bet-confirm-modal');
  }

  function tryAddBets(type, picksList) {
    const amount = UNIT();
    const cost = picksList.length * amount;
    if (!canAfford(cost)) {
      showMoneyError();
      return false;
    }
    const stamp = Date.now();
    picksList.forEach((picks, i) => {
      bets.push({
        id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        picks: [...picks],
        amount,
        odds: K.getOdds(oddsTable, type, picks),
      });
    });
    refreshPurchaseUI();
    return true;
  }

  /** 個別購入：チェック維持、選択パネルは開いたまま */
  function buyOneCombo(picks) {
    tryAddBets(betType, [picks]);
  }

  /** すべて購入：追加後チェック解除→購入馬券パネルへ */
  function buyAllCombos() {
    const picksList = K.expandFormation(betType, formation);
    if (!picksList.length) return;

    const amount = UNIT();
    const cost = picksList.length * amount;
    if (!canAfford(cost)) {
      showMoneyError();
      return;
    }

    const stamp = Date.now();
    picksList.forEach((picks, i) => {
      bets.push({
        id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        type: betType,
        picks: [...picks],
        amount,
        odds: K.getOdds(oddsTable, betType, picks),
      });
    });

    resetFormation();
    refreshPurchaseUI();
  }

  function deleteBet(id) {
    bets = bets.filter((b) => b.id !== id);
    refreshPurchaseUI();
  }

  function cancelAllBets() {
    bets = [];
    resetFormation();
    refreshPurchaseUI();
  }

  function requestRaceStart() {
    const total = bets.reduce((s, b) => s + b.amount, 0);
    if (total > state.money) {
      K.$('confirm-message').textContent = '所持金が不足しています';
      K.openModal('confirm-modal');
      K.$('confirm-yes').hidden = true;
      return;
    }
    K.$('confirm-yes').hidden = false;
    K.$('confirm-message').textContent = bets.length === 0
      ? '馬券未購入ですがレースを開始しますか？'
      : 'レースを開始しますか？';
    K.openModal('confirm-modal');
  }

  function beginRace() {
    K.closeModal('confirm-modal');
    const total = bets.reduce((s, b) => s + b.amount, 0);
    state.money -= total;
    K.saveState(state);

    K.showScreen('screen-race');
    K.$('race-title').textContent =
      `${race.setup.surface} ${race.setup.distance}m（${race.setup.condition}）`;
    K.$('race-timer').textContent = '0.0s';

    if (raceAnim) raceAnim.stop();
    raceAnim = K.createRaceAnimation({
      trackEl: K.$('track'),
      lanesEl: K.$('track-lanes'),
      timerEl: K.$('race-timer'),
      finishOrder: race.finishOrder,
      stylesById: race.setup.styles,
      onComplete: showRaceResult,
    });

    setTimeout(() => raceAnim.start(), 400);
  }

  function showRaceResult() {
    const finishOrder = race.finishOrder;
    const settled = bets.map((bet) => {
      const result = K.settleBet(bet, finishOrder);
      return { bet, ...result };
    });

    const payoutTotal = settled.reduce((s, x) => s + x.payout, 0);
    const hitTickets = settled.filter((x) => x.hit).length;
    const betTotal = bets.reduce((s, b) => s + b.amount, 0);

    state.money += payoutTotal;
    state.raceCount += 1;
    state.hitCount += hitTickets;
    state.betTicketCount += bets.length;
    state.totalBetAmount += betTotal;
    state.totalPayoutAmount += payoutTotal;
    K.saveState(state);

    K.renderResult({
      finishOrder,
      settled,
      payoutTotal,
      money: state.money,
      oddsTable,
    });
    K.showScreen('screen-result');
  }

  function bindEvents() {
    K.$('btn-start').addEventListener('click', startNewRace);

    K.$('btn-cycle-bet').addEventListener('click', cycleBetType);

    K.$('btn-cancel-bets').addEventListener('click', cancelAllBets);
    K.$('btn-race-start').addEventListener('click', requestRaceStart);

    K.$('confirm-yes').addEventListener('click', () => {
      if (K.$('confirm-yes').hidden) {
        K.closeModal('confirm-modal');
        K.$('confirm-yes').hidden = false;
        return;
      }
      beginRace();
    });
    K.$('confirm-no').addEventListener('click', () => {
      K.closeModal('confirm-modal');
      K.$('confirm-yes').hidden = false;
    });

    K.$('bet-confirm-yes').addEventListener('click', () => {
      K.closeModal('bet-confirm-modal');
      K.$('bet-confirm-yes').hidden = false;
    });
    K.$('bet-confirm-no').addEventListener('click', () => {
      K.closeModal('bet-confirm-modal');
      K.$('bet-confirm-yes').hidden = false;
    });

    document.querySelectorAll('[data-close="ability"]').forEach((el) => {
      el.addEventListener('click', () => K.closeModal('ability-modal'));
    });
    document.querySelectorAll('[data-close="confirm"]').forEach((el) => {
      el.addEventListener('click', () => {
        K.closeModal('confirm-modal');
        K.$('confirm-yes').hidden = false;
      });
    });
    document.querySelectorAll('[data-close="bet-confirm"]').forEach((el) => {
      el.addEventListener('click', () => {
        K.closeModal('bet-confirm-modal');
        K.$('bet-confirm-yes').hidden = false;
      });
    });

    K.$('btn-next-race').addEventListener('click', startNewRace);
  }

  function init() {
    bindEvents();
    K.renderTitleStats(state);
    K.showScreen('screen-title');
    if (state.money <= 0) {
      state.money = K.INITIAL_MONEY;
      K.saveState(state);
    }
  }

  init();
})();
