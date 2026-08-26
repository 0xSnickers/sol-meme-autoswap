import { normalizeSignalChain } from './chain-config.js';

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readChainNumber(env, chain, suffix, fallback) {
  const prefix = normalizeSignalChain(chain).toUpperCase();
  return toNumber(env[`SIGNAL_${prefix}_${suffix}`], fallback);
}

export function buildChainTradeRules(chain, baseRules, env = process.env) {
  return {
    ...baseRules,
    scoreThreshold: readChainNumber(env, chain, 'TRADE_SCORE_THRESHOLD', baseRules.scoreThreshold),
    minSmartMoney: readChainNumber(env, chain, 'TRADE_MIN_SMART_MONEY', baseRules.minSmartMoney),
    minLiquidity: readChainNumber(env, chain, 'TRADE_MIN_LIQUIDITY', baseRules.minLiquidity),
    minVolume: readChainNumber(env, chain, 'TRADE_MIN_VOLUME', baseRules.minVolume),
    minBuySellRatio: readChainNumber(
      env,
      chain,
      'TRADE_MIN_BUY_SELL_RATIO',
      baseRules.minBuySellRatio
    ),
    maxTokenAgeHours: readChainNumber(
      env,
      chain,
      'TRADE_MAX_TOKEN_AGE_HOURS',
      baseRules.maxTokenAgeHours
    ),
    hotModeMinSmartMoney: readChainNumber(
      env,
      chain,
      'TRADE_HOT_MODE_MIN_SMART_MONEY',
      baseRules.hotModeMinSmartMoney
    ),
    hotModeMinLiquidity: readChainNumber(
      env,
      chain,
      'TRADE_HOT_MODE_MIN_LIQUIDITY',
      baseRules.hotModeMinLiquidity
    ),
    hotModeMinBuySellRatio: readChainNumber(
      env,
      chain,
      'TRADE_HOT_MODE_MIN_BUY_SELL_RATIO',
      baseRules.hotModeMinBuySellRatio
    ),
    hotModeMinScore: readChainNumber(
      env,
      chain,
      'TRADE_HOT_MODE_MIN_SCORE',
      baseRules.hotModeMinScore
    ),
  };
}

const DEFAULT_EXECUTION_PROFILES = Object.freeze({
  sol: Object.freeze({ buyCostBps: 100, sellCostBps: 100, fixedCostUsd: 0.02 }),
  bsc: Object.freeze({ buyCostBps: 100, sellCostBps: 100, fixedCostUsd: 0.05 }),
  base: Object.freeze({ buyCostBps: 100, sellCostBps: 100, fixedCostUsd: 0.03 }),
});

export function getChainExecutionProfile(chain, env = process.env) {
  const normalized = normalizeSignalChain(chain);
  const fallback = DEFAULT_EXECUTION_PROFILES[normalized] || DEFAULT_EXECUTION_PROFILES.sol;
  return {
    buyCostBps: Math.max(
      0,
      readChainNumber(env, normalized, 'EXECUTION_BUY_COST_BPS', fallback.buyCostBps)
    ),
    sellCostBps: Math.max(
      0,
      readChainNumber(env, normalized, 'EXECUTION_SELL_COST_BPS', fallback.sellCostBps)
    ),
    fixedCostUsd: Math.max(
      0,
      readChainNumber(env, normalized, 'EXECUTION_FIXED_COST_USD', fallback.fixedCostUsd)
    ),
  };
}

export function getPaperBuyExecution({ chain, quotedPrice, totalCostUsd }, env = process.env) {
  const profile = getChainExecutionProfile(chain, env);
  const spendableUsd = Math.max(0, Number(totalCostUsd || 0) - profile.fixedCostUsd);
  const effectivePrice = Number(quotedPrice || 0) * (1 + profile.buyCostBps / 10_000);
  return {
    effectivePrice,
    fixedCostUsd: profile.fixedCostUsd,
    tokenAmount: effectivePrice > 0 ? spendableUsd / effectivePrice : 0,
  };
}

export function getPaperSellExecution({ chain, quotedPrice, tokenAmount }, env = process.env) {
  const profile = getChainExecutionProfile(chain, env);
  const effectivePrice = Number(quotedPrice || 0) * (1 - profile.sellCostBps / 10_000);
  const grossProceedsUsd = Math.max(0, Number(tokenAmount || 0) * effectivePrice);
  return {
    effectivePrice,
    fixedCostUsd: profile.fixedCostUsd,
    netProceedsUsd: Math.max(0, grossProceedsUsd - profile.fixedCostUsd),
  };
}
