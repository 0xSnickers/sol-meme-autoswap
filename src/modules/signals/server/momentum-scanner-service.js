export function createMomentumScannerService({
  checkTokenSafety,
  classifyNarrative,
  classifyStars,
  fetchTokenDescription,
  formatMomentumAlert,
  getPushQualityResultBase,
  gmgnGet,
  log,
  mapToken,
  momentumConsecutiveUp,
  momentumPushed,
  momentumTracker,
  minLiquidity,
  minMarketCap,
  minSmartDegenCount,
  maxMarketCap,
  passesPushQualityGateBase,
  pushMinBuySellRatio,
  pushMinHolders,
  pushMinLiquidity,
  pushMinVolume,
  requireSocials,
  sleep,
  chains,
}) {
  function getPushQualityOptions() {
    return {
      pushMinLiquidity,
      pushMinHolders,
      pushMinVolume,
      pushMinBuySellRatio,
      requireSocials,
    };
  }

  function getPushQualityResult(token, descInfo = {}) {
    return getPushQualityResultBase(token, descInfo, getPushQualityOptions());
  }

  function passesPushQualityGate(token, descInfo) {
    return passesPushQualityGateBase(token, descInfo, getPushQualityOptions());
  }

  function getMomentumState(token) {
    const tokenKey = `${token.chain}:${String(token.address || '').toLowerCase()}`;
    const snapshots = momentumTracker.get(tokenKey) || [];
    const recent = snapshots.slice(-momentumConsecutiveUp);
    const rounds = recent.length;

    let consecutiveUp = rounds >= momentumConsecutiveUp;
    let volIncreasing = rounds >= 2;

    for (let i = 1; i < recent.length; i += 1) {
      const prevMc = recent[i - 1].mc;
      const currMc = recent[i].mc;
      if (prevMc <= 0 || currMc <= prevMc) {
        consecutiveUp = false;
        break;
      }
    }

    for (let i = 1; i < recent.length; i += 1) {
      if (recent[i].buys < recent[i - 1].buys * 0.8) {
        volIncreasing = false;
        break;
      }
    }

    const firstMc = recent[0]?.mc || 0;
    const lastMc = recent[recent.length - 1]?.mc || 0;
    const pctGain = firstMc > 0 ? ((lastMc - firstMc) / firstMc) * 100 : 0;

    return {
      snapshots,
      rounds,
      consecutiveUp,
      volIncreasing,
      pctGain,
    };
  }

  async function fetchNewTokens() {
    const allTokens = [];
    const seenTokens = new Set();
    const requestErrors = [];

    for (const chain of chains) {
      const urls = [
        `https://gmgn.ai/defi/quotation/v1/rank/${chain}/swaps/1h?orderby=open_timestamp&direction=desc&limit=100`,
        `https://gmgn.ai/defi/quotation/v1/rank/${chain}/swaps/1h?orderby=swaps&direction=desc&limit=50`,
      ];

      for (const url of urls) {
        let data;
        try {
          data = await gmgnGet(url);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          requestErrors.push(`${url} -> ${reason}`);
          continue;
        }
        const rank = data.rank || [];

        for (const token of rank) {
          const mapped = mapToken(chain, token);
          const tokenKey = `${mapped.chain}:${String(mapped.address || '').toLowerCase()}`;
          if (!mapped.address || seenTokens.has(tokenKey)) {
            continue;
          }
          if (mapped.mc < minMarketCap || mapped.liq < minLiquidity || mapped.mc > maxMarketCap) {
            continue;
          }

          seenTokens.add(tokenKey);
          allTokens.push(mapped);
        }

        await sleep(300);
      }
    }

    if (allTokens.length === 0 && requestErrors.length > 0) {
      log('[GMGN] 候选币列表获取失败，当前返回 0 个候选币。');
      for (const error of requestErrors.slice(0, 3)) {
        log(`[GMGN] ${error}`);
      }
    }

    return allTokens;
  }

  async function trackMomentum(tokens) {
    const now = Date.now() / 1000;
    const alerts = [];
    const currentTokenKeys = new Set();

    for (const token of tokens) {
      const address = token.address;
      const tokenKey = `${token.chain}:${String(address || '').toLowerCase()}`;
      currentTokenKeys.add(tokenKey);

      if (token.mc < minMarketCap || token.liq < minLiquidity || token.mc > maxMarketCap) {
        continue;
      }

      const volume = token.volume || 0;
      const price = token.price || 0;
      const buys = token.buys_1h || token.buys || 0;
      const snapshots = momentumTracker.get(tokenKey) || [];

      if (
        snapshots.length > 0 &&
        snapshots[snapshots.length - 1].mc === token.mc &&
        snapshots[snapshots.length - 1].vol === volume
      ) {
        momentumTracker.set(tokenKey, snapshots);
        continue;
      }

      snapshots.push({
        ts: now,
        mc: token.mc,
        vol: volume,
        price,
        buys,
      });

      if (snapshots.length > 20) {
        snapshots.splice(0, snapshots.length - 20);
      }
      momentumTracker.set(tokenKey, snapshots);

      if (snapshots.length < momentumConsecutiveUp) {
        continue;
      }

      const recent = snapshots.slice(-momentumConsecutiveUp);
      let consecutiveUp = true;

      for (let i = 1; i < recent.length; i += 1) {
        const prevMc = recent[i - 1].mc;
        const currMc = recent[i].mc;
        if (prevMc <= 0 || currMc <= prevMc) {
          consecutiveUp = false;
          break;
        }
      }

      if (!consecutiveUp) {
        continue;
      }

      let volIncreasing = true;
      for (let i = 1; i < recent.length; i += 1) {
        if (recent[i].buys < recent[i - 1].buys * 0.8) {
          volIncreasing = false;
          break;
        }
      }

      const firstMc = recent[0].mc;
      const lastMc = recent[recent.length - 1].mc;
      const pctGain = firstMc > 0 ? ((lastMc - firstMc) / firstMc) * 100 : 0;
      if (pctGain < 5) {
        continue;
      }

      if ((token.sm || 0) < minSmartDegenCount) {
        continue;
      }

      const pushInfo = momentumPushed.get(tokenKey) || {
        count: 0,
        lastTs: 0,
        lastMc: 0,
      };

      if (pushInfo.count > 0 && lastMc <= pushInfo.lastMc) {
        continue;
      }

      const safety = await checkTokenSafety(token.chain, address);
      if (!safety.safe) {
        continue;
      }

      const [category, matchedKeywords] = classifyNarrative(token.name, token.symbol, token.chain);
      const descInfo = await fetchTokenDescription(token.chain, address);
      if (!passesPushQualityGate(token, descInfo)) {
        continue;
      }
      const { stars, narrativeTag } = classifyStars(
        token,
        category,
        matchedKeywords || [],
        descInfo
      );

      pushInfo.count += 1;
      pushInfo.lastTs = now;
      pushInfo.lastMc = lastMc;
      momentumPushed.set(tokenKey, pushInfo);

      const message = formatMomentumAlert(
        token,
        pctGain,
        recent.length,
        volIncreasing,
        stars,
        narrativeTag,
        descInfo,
        pushInfo.count
      );

      alerts.push({
        msg: message,
        token,
        pctGain,
        rounds: recent.length,
        volUp: volIncreasing,
        descInfo,
        stars,
        narrativeTag,
        category,
        matchedKeywords: matchedKeywords || [],
        signalCount: pushInfo.count,
      });
      log(
        `[动量信号${pushInfo.count}] ${token.name} (${token.symbol}) on ${token.chain} — 连涨${recent.length}轮 +${pctGain.toFixed(1)}%`
      );
    }

    for (const [tokenKey, snapshots] of momentumTracker.entries()) {
      if (!currentTokenKeys.has(tokenKey) && now - snapshots[snapshots.length - 1].ts > 600) {
        momentumTracker.delete(tokenKey);
      }
    }

    for (const [tokenKey, info] of momentumPushed.entries()) {
      if (now - info.lastTs > 3600) {
        momentumPushed.delete(tokenKey);
      }
    }

    alerts.sort((left, right) => right.pctGain - left.pctGain);
    return alerts;
  }

  return {
    fetchNewTokens,
    getMomentumState,
    getPushQualityOptions,
    getPushQualityResult,
    passesPushQualityGate,
    trackMomentum,
  };
}
