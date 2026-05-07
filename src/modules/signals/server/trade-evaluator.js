export const DEFAULT_TRADE_RULES = {
  scoreThreshold: 64,
  minSmartMoney: 3,
  headEntrySignalCount: 1,
  secondHeadEntrySignalCount: 2,
  maxSignalCount: 3,
  minLiquidity: 15_000,
  minVolume: 30_000,
  minBuySellRatio: 1.4,
  maxTokenAgeHours: 48,
  hotModeChange1h: 50,
  hotModeMinSmartMoney: 5,
  hotModeMinLiquidity: 30_000,
  hotModeMinBuySellRatio: 1.6,
  hotModeMinScore: 68,
  scoreAverageLookback: 3,
  secondHeadMinScoreDelta: 5,
  secondHeadMinScore: 68,
};

export function buildTradeRulesFromEnv(env = process.env) {
  const scoreThreshold = Number(env.RADAR_TRADE_SCORE_THRESHOLD || DEFAULT_TRADE_RULES.scoreThreshold);

  return {
    scoreThreshold,
    minSmartMoney: Number(env.RADAR_TRADE_MIN_SMART_MONEY || DEFAULT_TRADE_RULES.minSmartMoney),
    headEntrySignalCount: DEFAULT_TRADE_RULES.headEntrySignalCount,
    secondHeadEntrySignalCount: DEFAULT_TRADE_RULES.secondHeadEntrySignalCount,
    maxSignalCount: Number(env.RADAR_TRADE_MAX_SIGNAL_COUNT || DEFAULT_TRADE_RULES.maxSignalCount),
    minLiquidity: Number(env.RADAR_TRADE_MIN_LIQUIDITY || DEFAULT_TRADE_RULES.minLiquidity),
    minVolume: Number(env.RADAR_TRADE_MIN_VOLUME || DEFAULT_TRADE_RULES.minVolume),
    minBuySellRatio: Number(env.RADAR_TRADE_MIN_BUY_SELL_RATIO || DEFAULT_TRADE_RULES.minBuySellRatio),
    maxTokenAgeHours: Number(env.RADAR_TRADE_MAX_TOKEN_AGE_HOURS || DEFAULT_TRADE_RULES.maxTokenAgeHours),
    hotModeChange1h: Number(env.RADAR_TRADE_HOT_MODE_CHANGE_1H || DEFAULT_TRADE_RULES.hotModeChange1h),
    hotModeMinSmartMoney: Number(
      env.RADAR_TRADE_HOT_MODE_MIN_SMART_MONEY || DEFAULT_TRADE_RULES.hotModeMinSmartMoney
    ),
    hotModeMinLiquidity: Number(
      env.RADAR_TRADE_HOT_MODE_MIN_LIQUIDITY || DEFAULT_TRADE_RULES.hotModeMinLiquidity
    ),
    hotModeMinBuySellRatio: Number(
      env.RADAR_TRADE_HOT_MODE_MIN_BUY_SELL_RATIO || DEFAULT_TRADE_RULES.hotModeMinBuySellRatio
    ),
    hotModeMinScore: Number(env.RADAR_TRADE_HOT_MODE_MIN_SCORE || DEFAULT_TRADE_RULES.hotModeMinScore),
    scoreAverageLookback: DEFAULT_TRADE_RULES.scoreAverageLookback,
    secondHeadMinScoreDelta: Number(
      env.RADAR_TRADE_SECOND_HEAD_MIN_SCORE_DELTA || DEFAULT_TRADE_RULES.secondHeadMinScoreDelta
    ),
    secondHeadMinScore: Number(
      env.RADAR_TRADE_SECOND_HEAD_MIN_SCORE ||
        Math.max(scoreThreshold + 4, DEFAULT_TRADE_RULES.secondHeadMinScore)
    ),
  };
}

export function normalizeTradeCandidate(input, { getBuySellMetrics } = {}) {
  if (input.token) {
    const token = input.token;
    return {
      signalCount: input.signalCount || 1,
      sm: token.sm || 0,
      liq: token.liq || 0,
      volume: token.volume || 0,
      chg_1h: token.chg_1h || 0,
      ageHours: token.age_h || 0,
      pctGain: input.pctGain || 0,
      buySellRatio: Number(getBuySellMetrics(token).buySellRatio.toFixed(2)),
    };
  }

  return {
    signalCount: input.signalCount || 1,
    sm: input.smartMoney || 0,
    liq: input.liq || 0,
    volume: input.volume || 0,
    chg_1h: input.change1h || 0,
    ageHours: input.ageHours || 0,
    pctGain: input.pctGain || 0,
    buySellRatio: Number((input.buySellRatio || 0).toFixed(2)),
  };
}

export function getTradeScore(alert, { getBuySellMetrics, roundTo, rules = DEFAULT_TRADE_RULES } = {}) {
  const candidate = normalizeTradeCandidate(alert, { getBuySellMetrics });
  const parts = [];
  let score = 0;

  if (candidate.sm >= 15) {
    score += 30;
    parts.push('聪明钱>=15 +30');
  } else if (candidate.sm >= 8) {
    score += 22;
    parts.push('聪明钱8-14 +22');
  } else if (candidate.sm >= 5) {
    score += 14;
    parts.push('聪明钱5-7 +14');
  } else if (candidate.sm >= 3) {
    score += 8;
    parts.push('聪明钱3-4 +8');
  } else if (candidate.sm >= 2) {
    score += 4;
    parts.push('聪明钱=2 +4');
  }

  if (candidate.signalCount <= 1) {
    score += 10;
    parts.push('第1次信号 +10');
  } else if (candidate.signalCount === 2) {
    score += 6;
    parts.push('第2次信号 +6');
  } else if (candidate.signalCount === 3) {
    score += 2;
    parts.push('第3次信号 +2');
  } else {
    score -= 6;
    parts.push('第4次及以上 -6');
  }

  if (candidate.pctGain >= 15) {
    score += 15;
    parts.push('扫描窗口涨幅>=15% +15');
  } else if (candidate.pctGain >= 10) {
    score += 12;
    parts.push('扫描窗口涨幅>=10% +12');
  } else if (candidate.pctGain >= 8) {
    score += 8;
    parts.push('扫描窗口涨幅>=8% +8');
  } else if (candidate.pctGain >= 5) {
    score += 5;
    parts.push('扫描窗口涨幅>=5% +5');
  }

  if (candidate.liq >= 100_000) {
    score += 16;
    parts.push('流动性>=100000 +16');
  } else if (candidate.liq >= 50_000) {
    score += 12;
    parts.push('流动性>=50000 +12');
  } else if (candidate.liq >= 20_000) {
    score += 10;
    parts.push('流动性>=20000 +10');
  } else if (candidate.liq >= 10_000) {
    score += 6;
    parts.push('流动性>=10000 +6');
  } else if (candidate.liq >= 5_000) {
    score += 2;
    parts.push('流动性>=5000 +2');
  }

  if (candidate.volume >= 500_000) {
    score += 16;
    parts.push('1h量>=500000 +16');
  } else if (candidate.volume >= 200_000) {
    score += 12;
    parts.push('1h量>=200000 +12');
  } else if (candidate.volume >= 100_000) {
    score += 10;
    parts.push('1h量>=100000 +10');
  } else if (candidate.volume >= 50_000) {
    score += 7;
    parts.push('1h量>=50000 +7');
  } else if (candidate.volume >= 30_000) {
    score += 4;
    parts.push('1h量>=30000 +4');
  }

  if (candidate.buySellRatio >= 2) {
    score += 12;
    parts.push('买卖比>=2.0 +12');
  } else if (candidate.buySellRatio >= 1.8) {
    score += 9;
    parts.push('买卖比>=1.8 +9');
  } else if (candidate.buySellRatio >= 1.6) {
    score += 6;
    parts.push('买卖比>=1.6 +6');
  } else if (candidate.buySellRatio >= 1.4) {
    score += 3;
    parts.push('买卖比>=1.4 +3');
  } else if (candidate.buySellRatio < 1.2) {
    score -= 6;
    parts.push('买卖比<1.2 -6');
  } else if (candidate.buySellRatio < 1.4) {
    score -= 2;
    parts.push('买卖比<1.4 -2');
  }

  if (candidate.ageHours <= 6) {
    score += 5;
    parts.push('币龄<=6h +5');
  } else if (candidate.ageHours <= 12) {
    score += 4;
    parts.push('币龄<=12h +4');
  } else if (candidate.ageHours <= 24) {
    score += 3;
    parts.push('币龄<=24h +3');
  } else if (candidate.ageHours <= rules.maxTokenAgeHours) {
    score += 1;
    parts.push(`币龄<=${rules.maxTokenAgeHours}h +1`);
  }

  if (candidate.chg_1h >= 80) {
    score -= 18;
    parts.push('1h涨幅>=80% -18');
  } else if (candidate.chg_1h >= 50) {
    score -= 10;
    parts.push('1h涨幅>=50% -10');
  } else if (candidate.chg_1h >= 30) {
    score -= 4;
    parts.push('1h涨幅>=30% -4');
  }

  return {
    score: Math.max(0, roundTo(score, 0)),
    parts,
    buySellRatio: candidate.buySellRatio,
  };
}

export function getTradeScoreHistoryFromAlert(alert) {
  const rawHistory = Array.isArray(alert?.signalHistory) ? alert.signalHistory : [];
  const expectedPreviousCount = Math.max(0, Number(alert?.signalCount || 0) - 1);
  const scores = rawHistory
    .map((entry) => Number(entry?.tradeScore))
    .filter((score) => Number.isFinite(score));

  if (expectedPreviousCount <= 0) {
    return [];
  }
  if (scores.length >= expectedPreviousCount) {
    return scores.slice(0, expectedPreviousCount);
  }
  return scores;
}

export function getTradeScoreStats(currentScore, historyScores = [], { roundTo, rules = DEFAULT_TRADE_RULES } = {}) {
  const previousScores = historyScores
    .map((score) => Number(score))
    .filter((score) => Number.isFinite(score))
    .slice(-(rules.scoreAverageLookback - 1));
  const recentScores = [...previousScores, Number(currentScore || 0)].slice(-rules.scoreAverageLookback);
  const scoreTotal = recentScores.reduce((sum, score) => sum + score, 0);
  const averageScore = recentScores.length > 0 ? roundTo(scoreTotal / recentScores.length, 1) : 0;
  const previousScore =
    recentScores.length > 1 ? recentScores[recentScores.length - 2] : Number(currentScore || 0);
  const trendDelta = roundTo(Number(currentScore || 0) - previousScore, 1);

  return {
    recentScores,
    averageScore,
    trendDelta,
    previousScore,
  };
}

export function evaluateTradeIntent(
  alert,
  {
    historyScores,
    openPosition = null,
    getBuySellMetrics,
    roundTo,
    rules = DEFAULT_TRADE_RULES,
  } = {}
) {
  const candidate = normalizeTradeCandidate(alert, { getBuySellMetrics });
  const scoreInfo = getTradeScore(alert, { getBuySellMetrics, roundTo, rules });
  const resolvedHistoryScores = historyScores || getTradeScoreHistoryFromAlert(alert);
  const scoreStats = getTradeScoreStats(scoreInfo.score, resolvedHistoryScores, { roundTo, rules });
  const hasOpenPosition = Boolean(openPosition);
  const reasons = [];

  if (!hasOpenPosition && scoreInfo.score < rules.scoreThreshold) {
    reasons.push(`交易评分低于 ${rules.scoreThreshold}`);
  }
  if (candidate.signalCount > rules.maxSignalCount) {
    reasons.push(`信号次数超过 ${rules.maxSignalCount}`);
  }
  if (candidate.sm < rules.minSmartMoney) {
    reasons.push(`聪明钱低于 ${rules.minSmartMoney}`);
  }
  if (candidate.liq < rules.minLiquidity) {
    reasons.push(`流动性低于 ${rules.minLiquidity}`);
  }
  if (candidate.volume < rules.minVolume) {
    reasons.push(`1h成交量低于 ${rules.minVolume}`);
  }
  if (scoreInfo.buySellRatio < rules.minBuySellRatio) {
    reasons.push(`买卖比低于 ${rules.minBuySellRatio}`);
  }
  if (candidate.ageHours > rules.maxTokenAgeHours) {
    reasons.push(`Token 币龄超过 ${rules.maxTokenAgeHours} 小时`);
  }
  if (candidate.chg_1h >= rules.hotModeChange1h) {
    if (scoreInfo.score < rules.hotModeMinScore) {
      reasons.push(`高热模式下评分需达到 ${rules.hotModeMinScore}`);
    }
    if (candidate.sm < rules.hotModeMinSmartMoney) {
      reasons.push(`高热模式下聪明钱需达到 ${rules.hotModeMinSmartMoney}`);
    }
    if (candidate.liq < rules.hotModeMinLiquidity) {
      reasons.push(`高热模式下流动性需达到 ${rules.hotModeMinLiquidity}`);
    }
    if (scoreInfo.buySellRatio < rules.hotModeMinBuySellRatio) {
      reasons.push(`高热模式下买卖比需达到 ${rules.hotModeMinBuySellRatio}`);
    }
  }

  let positionAction = 'open_head';
  let successLabel = '满足链上模拟交易头仓条件';
  if (!hasOpenPosition) {
    if (candidate.signalCount > rules.secondHeadEntrySignalCount) {
      reasons.push(`头仓仅允许第 ${rules.headEntrySignalCount}-${rules.secondHeadEntrySignalCount} 次信号建立`);
    } else if (candidate.signalCount > rules.headEntrySignalCount) {
      const hasPreviousScore = resolvedHistoryScores.length > 0;
      const previousScore = Number(scoreStats.previousScore || 0);
      const scoreDelta = scoreInfo.score - previousScore;
      const scoreStrengthenedEnough = scoreDelta >= rules.secondHeadMinScoreDelta;

      positionAction = 'open_head_retry';
      successLabel = `第2次信号评分至少走强 ${rules.secondHeadMinScoreDelta} 分，允许补开头仓`;

      if (!hasPreviousScore) {
        reasons.push('缺少上一次评分记录，暂不允许第2次信号补开头仓');
      } else if (scoreInfo.score < rules.secondHeadMinScore) {
        reasons.push(`第2次补开头仓评分低于 ${rules.secondHeadMinScore}`);
      } else if (!scoreStrengthenedEnough) {
        reasons.push(
          `第2次信号评分走强不足 ${rules.secondHeadMinScoreDelta} 分 (${scoreInfo.score} vs ${previousScore})`
        );
      }
    }
  } else {
    positionAction = 'hold_existing';
    successLabel = '已有打开持仓，头仓已一次性买满';
    reasons.push('已持有目标仓位，当前策略不再分批加仓');
  }

  return {
    tradeScore: scoreInfo.score,
    scoreBreakdown: scoreInfo.parts,
    buySellRatio: scoreInfo.buySellRatio,
    scoreStats,
    approved: reasons.length === 0,
    decisionReason:
      reasons.length === 0
        ? `${successLabel} | 最近${scoreStats.recentScores.length}次均分 ${scoreStats.averageScore}`
        : reasons.join(' | '),
    intentStatus: reasons.length === 0 ? 'approved' : hasOpenPosition ? 'skipped' : 'rejected',
    positionAction,
  };
}
