import '../../../lib/signal-env.js';
import { addBn, divBn, mulBn, roundBn, subBn, sumBn } from '../../../lib/bignumber-utils.js';
import { createOutboundHttpClient } from '../../../lib/outbound-http.js';
import { resolveSignalDbDriver } from '../../../shared/db/client/index.js';
import { gmgnGet as gmgnGetBase, mapGmgnToken } from '../server/gmgn-client.js';
import { createLivePriceSnapshotService } from '../server/live-price-snapshot-service.js';
import { createGmgnHeaders } from '../server/scanner-runtime.js';
import { getConfiguredSignalChains, getSignalChainKey } from '../lib/chain-config.js';
import { readPersistedSignalSnapshotFromDrizzle } from './persisted-signal-query-service.js';

let cachedRealtimeSignalQueryService = null;

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRealtimeScannerFilters(env = process.env) {
  return {
    minMarketCap: toNumber(env.RADAR_MIN_MC || env.SIGNAL_MIN_MC, 1_000),
    maxMarketCap: toNumber(env.RADAR_MAX_MC || env.SIGNAL_MAX_MC, 2_000_000),
    minLiquidity: toNumber(env.RADAR_MIN_LIQUIDITY || env.SIGNAL_MIN_LIQUIDITY, 500),
    paperTotalCapitalUsd: toNumber(
      env.RADAR_PAPER_TOTAL_CAPITAL_USD || env.SIGNAL_PAPER_TOTAL_CAPITAL_USD,
      1_000
    ),
  };
}

function createRealtimeFetchNewTokens({ env = process.env, fetchJson }) {
  const headers = createGmgnHeaders();
  const { minMarketCap, maxMarketCap, minLiquidity } = getRealtimeScannerFilters(env);

  return async function fetchNewTokens() {
    const allTokens = [];
    const seenTokens = new Set();
    const chains = getConfiguredSignalChains(env);

    for (const chain of chains) {
      const urls = [
        `https://gmgn.ai/defi/quotation/v1/rank/${chain}/swaps/1h?orderby=open_timestamp&direction=desc&limit=100`,
        `https://gmgn.ai/defi/quotation/v1/rank/${chain}/swaps/1h?orderby=swaps&direction=desc&limit=50`,
      ];

      for (const url of urls) {
        let data;
        try {
          data = await gmgnGetBase(url, { fetchJson, headers, sleep });
        } catch {
          continue;
        }

        const rank = Array.isArray(data.rank) ? data.rank : [];
        for (const token of rank) {
          const mapped = mapGmgnToken(chain, token);
          const tokenKey = getSignalChainKey(mapped.chain, mapped.address);
          if (!mapped.address || seenTokens.has(tokenKey)) {
            continue;
          }
          if (
            mapped.mc < minMarketCap ||
            mapped.liq < minLiquidity ||
            mapped.mc > maxMarketCap
          ) {
            continue;
          }

          seenTokens.add(tokenKey);
          allTokens.push(mapped);
        }

        await sleep(300);
      }
    }

    return allTokens;
  };
}

function createRealtimeSignalQueryService({ env = process.env } = {}) {
  const { fetchJson } = createOutboundHttpClient({ env });
  const { paperTotalCapitalUsd } = getRealtimeScannerFilters(env);
  const fetchNewTokens = createRealtimeFetchNewTokens({ env, fetchJson });

  return createLivePriceSnapshotService({
    addBn,
    divBn,
    fetchJson,
    fetchNewTokens,
    getPersistedRadarSnapshot(limit) {
      return readPersistedSignalSnapshotFromDrizzle(limit, { env });
    },
    mulBn,
    paperTotalCapitalUsd,
    roundTo: roundBn,
    subBn,
    sumBn,
  });
}

export function canUseDrizzleRealtimeSignalQueries(env = process.env) {
  const driver = resolveSignalDbDriver(env);
  return driver === 'sqlite' || driver === 'postgres';
}

export function getRealtimeSignalQueryService({ env = process.env, forceNew = false } = {}) {
  if (forceNew || !cachedRealtimeSignalQueryService) {
    cachedRealtimeSignalQueryService = createRealtimeSignalQueryService({ env });
  }
  return cachedRealtimeSignalQueryService;
}

export async function readRealtimeSignalSnapshotFromDrizzle(limit = 60, options = {}) {
  const service = options.service || getRealtimeSignalQueryService(options);
  return service.getRealtimeRadarSnapshot(limit);
}
