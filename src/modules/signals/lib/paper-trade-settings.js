export function normalizeTakeProfitSteps(steps = [], roundTo = defaultRoundTo) {
  const normalized = steps
    .map((step) => ({
      targetPercent: Number(step?.targetPercent ?? step?.pct ?? 0),
      sellPercent: Number(step?.sellPercent ?? step?.portion ?? 0),
    }))
    .filter((step) => Number.isFinite(step.targetPercent) && Number.isFinite(step.sellPercent))
    .map((step) => ({
      targetPercent: Math.max(1, roundTo(step.targetPercent, 2)),
      sellPercent: Math.max(1, Math.min(100, roundTo(step.sellPercent, 2))),
    }))
    .sort((left, right) => left.targetPercent - right.targetPercent);

  if (!normalized.length) {
    return [
      { targetPercent: 25, sellPercent: 55 },
      { targetPercent: 60, sellPercent: 25 },
      { targetPercent: 120, sellPercent: 20 },
    ];
  }

  let runningSellPercent = 0;
  return normalized
    .map((step) => {
      const remaining = Math.max(0, 100 - runningSellPercent);
      if (remaining <= 0) {
        return null;
      }
      const cappedSellPercent = Math.max(1, Math.min(step.sellPercent, remaining));
      runningSellPercent += cappedSellPercent;
      return {
        targetPercent: step.targetPercent,
        sellPercent: cappedSellPercent,
      };
    })
    .filter(Boolean);
}

export function parseTakeProfitStepsFromEnv(raw = '') {
  const source = String(raw || '').trim();
  if (!source) {
    return null;
  }

  const parsed = source
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [targetText, sellText] = chunk.split(':').map((part) => part.trim());
      const targetPercent = Number(targetText);
      const sellPercent = Number(sellText);
      if (!Number.isFinite(targetPercent) || !Number.isFinite(sellPercent)) {
        return null;
      }
      return { targetPercent, sellPercent };
    })
    .filter(Boolean);

  return parsed.length > 0 ? parsed : null;
}

export function buildLegacyTakeProfitStepsFromEnv(env = process.env) {
  const hasLegacyConfig =
    env.RADAR_PAPER_TP1_PERCENT ||
    env.RADAR_PAPER_TP1_SELL_PERCENT ||
    env.RADAR_PAPER_TP2_PERCENT ||
    env.RADAR_PAPER_TP2_SELL_PERCENT ||
    env.RADAR_PAPER_TP3_PERCENT ||
    env.RADAR_PAPER_TP3_SELL_PERCENT ||
    env.RADAR_PAPER_TP_PERCENT;

  if (!hasLegacyConfig) {
    return [
      { targetPercent: 80, sellPercent: 55 },
      { targetPercent: 150, sellPercent: 25 },
      { targetPercent: 260, sellPercent: 20 },
    ];
  }

  const steps = [
    {
      targetPercent: Number(env.RADAR_PAPER_TP1_PERCENT || 80),
      sellPercent: Number(env.RADAR_PAPER_TP1_SELL_PERCENT || 55),
    },
    {
      targetPercent: Number(env.RADAR_PAPER_TP2_PERCENT || 150),
      sellPercent: Number(env.RADAR_PAPER_TP2_SELL_PERCENT || 25),
    },
  ];

  if (env.RADAR_PAPER_TP3_PERCENT || env.RADAR_PAPER_TP3_SELL_PERCENT) {
    steps.push({
      targetPercent: Number(env.RADAR_PAPER_TP3_PERCENT || 260),
      sellPercent: Number(env.RADAR_PAPER_TP3_SELL_PERCENT || 20),
    });
  }

  return steps;
}

function defaultRoundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}
