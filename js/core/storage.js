window.Keiba = window.Keiba || {};

(function (K) {
  const defaultState = () => ({
    money: K.INITIAL_MONEY,
    raceCount: 0,
    hitCount: 0,
    betTicketCount: 0,
    totalBetAmount: 0,
    totalPayoutAmount: 0,
  });

  K.loadSave = function loadSave() {
    try {
      const raw = localStorage.getItem(K.STORAGE_KEY);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch {
      return defaultState();
    }
  };

  K.saveState = function saveState(state) {
    localStorage.setItem(K.STORAGE_KEY, JSON.stringify({
      money: state.money,
      raceCount: state.raceCount,
      hitCount: state.hitCount,
      betTicketCount: state.betTicketCount,
      totalBetAmount: state.totalBetAmount,
      totalPayoutAmount: state.totalPayoutAmount,
    }));
  };

  K.getHitRate = function getHitRate(state) {
    if (!state.betTicketCount) return 0;
    return (state.hitCount / state.betTicketCount) * 100;
  };

  K.getRecoveryRate = function getRecoveryRate(state) {
    if (!state.totalBetAmount) return 0;
    return (state.totalPayoutAmount / state.totalBetAmount) * 100;
  };
})(window.Keiba);
