function firstDefined(...values) {
  return values.find((value) => value != null);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function resolveScoreMetrics(alert) {
  const token = alert?.token || {};

  return {
    signalCount: toNumber(firstDefined(alert?.occurrenceCount, alert?.signalCount), 1),
    smartMoney: toNumber(firstDefined(alert?.smartMoney, token?.sm, token?.smartMoney)),
    pctGain: toNumber(firstDefined(alert?.pctGain, token?.pctGain)),
    liquidity: toNumber(firstDefined(alert?.liq, alert?.liquidity, token?.liq, token?.liquidity)),
    volume: toNumber(firstDefined(alert?.volume, token?.volume)),
    buySellRatio: toNumber(firstDefined(alert?.buySellRatio, token?.buySellRatio)),
    ageHours: toNumber(firstDefined(alert?.ageHours, token?.age_h, token?.ageHours)),
    oneHourChange: toNumber(firstDefined(alert?.change1h, token?.chg_1h, token?.change1h)),
    volUp: Boolean(
      firstDefined(
        alert?.volUp,
        alert?.volumeUp,
        alert?.volumeRising,
        token?.volUp,
        token?.volumeUp,
        token?.volumeRising
      )
    ),
  };
}

export function getTelegramTradeScore(alert) {
  const metrics = resolveScoreMetrics(alert);
  const signalCount = metrics.signalCount;
  const smartMoney = metrics.smartMoney;
  const pctGain = metrics.pctGain;
  const liquidity = metrics.liquidity;
  const volume = metrics.volume;
  const buySellRatio = metrics.buySellRatio;
  const ageHours = metrics.ageHours;
  const oneHourChange = metrics.oneHourChange;

  let score = 0;

  if (smartMoney >= 15) score += 30;
  else if (smartMoney >= 8) score += 22;
  else if (smartMoney >= 5) score += 14;
  else if (smartMoney >= 3) score += 8;
  else if (smartMoney >= 2) score += 4;

  if (signalCount <= 1) score += 10;
  else if (signalCount === 2) score += 6;
  else if (signalCount === 3) score += 2;
  else score -= 6;

  if (pctGain >= 15) score += 15;
  else if (pctGain >= 10) score += 12;
  else if (pctGain >= 8) score += 8;
  else if (pctGain >= 5) score += 5;

  if (liquidity >= 100000) score += 16;
  else if (liquidity >= 50000) score += 12;
  else if (liquidity >= 20000) score += 10;
  else if (liquidity >= 10000) score += 6;
  else if (liquidity >= 5000) score += 2;

  if (volume >= 500000) score += 16;
  else if (volume >= 200000) score += 12;
  else if (volume >= 100000) score += 10;
  else if (volume >= 50000) score += 7;
  else if (volume >= 30000) score += 4;

  if (buySellRatio >= 2) score += 12;
  else if (buySellRatio >= 1.8) score += 9;
  else if (buySellRatio >= 1.6) score += 6;
  else if (buySellRatio >= 1.4) score += 3;
  else if (buySellRatio < 1.2) score -= 6;
  else if (buySellRatio < 1.4) score -= 2;

  if (ageHours <= 6) score += 5;
  else if (ageHours <= 12) score += 4;
  else if (ageHours <= 24) score += 3;
  else if (ageHours <= 48) score += 1;

  if (oneHourChange >= 80) score -= 18;
  else if (oneHourChange >= 50) score -= 10;
  else if (oneHourChange >= 30) score -= 4;

  return buildScoreLabel(Math.max(0, Math.round(score)));
}

export function getPriceActionScore(alert) {
  const metrics = resolveScoreMetrics(alert);
  const rounds = metrics.signalCount;
  const pctGain = metrics.pctGain;
  const smartMoney = metrics.smartMoney;
  const volume = metrics.volume;
  const liquidity = metrics.liquidity;
  const oneHourChange = metrics.oneHourChange;
  const buySellRatio = metrics.buySellRatio;
  const volUp = metrics.volUp;

  let score = 0;

  if (rounds >= 3) score += 20;
  else if (rounds >= 2) score += 10;

  if (pctGain >= 30) score += 25;
  else if (pctGain >= 15) score += 18;
  else if (pctGain >= 8) score += 12;
  else if (pctGain >= 5) score += 8;

  if (volUp) score += 10;

  if (smartMoney >= 5) score += 15;
  else if (smartMoney >= 3) score += 10;
  else if (smartMoney >= 2) score += 6;

  if (buySellRatio >= 1.5) score += 12;
  else if (buySellRatio >= 1.2) score += 8;
  else if (buySellRatio >= 1.1) score += 5;

  if (volume >= 100000) score += 10;
  else if (volume >= 30000) score += 6;

  if (liquidity >= 20000) score += 8;
  else if (liquidity >= 10000) score += 5;

  if (oneHourChange >= 80) score -= 15;
  else if (oneHourChange >= 50) score -= 8;

  return buildScoreLabel(Math.max(0, Math.min(100, Math.round(score))));
}

function buildScoreLabel(score) {
  let label = '观察';
  if (score >= 80) label = '强势';
  else if (score >= 65) label = '偏强';
  else if (score >= 50) label = '中性';

  return { score, label };
}
