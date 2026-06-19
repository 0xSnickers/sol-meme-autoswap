export function createScanOrchestratorService({
  buildDashboardRows,
  buildDrizzleLocalResult = null,
  checkNarrativeNovelty,
  classifyNarrative,
  compareSignalPriority,
  ensureStorageReady = null,
  ensureStrategySessionMeta,
  fetchNewTokens,
  isTokenSeen,
  log,
  maxAlertsPerRound,
  minLiquidity,
  minMarketCap,
  narrativesRuntime,
  normalizeTheme,
  prepareRuntimeState = null,
  flushRuntimeState = null,
  recordToken,
  sleep,
  tgSend,
  trackMomentum,
}) {
  const stageDebugEnabled =
    String(process.env.SIGNAL_SCAN_DEBUG || process.env.RADAR_SCAN_DEBUG || 'false').toLowerCase() ===
    'true';

  async function runStage(name, work) {
    const startedAt = Date.now();
    try {
      return await work();
    } finally {
      if (stageDebugEnabled) {
        log(`[scan-stage] ${name} 完成，耗时 ${Date.now() - startedAt}ms`);
      }
    }
  }

  async function scanNarratives(options = {}) {
    const { deliver = true, rowLimit = 60 } = options;
    const db = null;

    try {
      await runStage('ensureStorageReady', () => ensureStorageReady?.());
      await runStage('ensureStrategySessionMeta', () => ensureStrategySessionMeta(db));

      const tokens = await fetchNewTokens();
      const runtimeState = prepareRuntimeState
        ? await runStage('prepareRuntimeState', () => prepareRuntimeState(tokens))
        : null;
      const scannedAt = new Date().toISOString();
      const scannedAtTs = Math.floor(Date.now() / 1000);
      log(`扫描 ${tokens.length} 个候选币...`);

      const momentumAlerts = await runStage('trackMomentum', () => trackMomentum([...tokens]));
      const dashboardRows = buildDashboardRows(tokens, momentumAlerts).slice(0, rowLimit);

      await runStage('processNarrativeStates', () => processNarrativeStates(tokens, db, runtimeState));
      if (runtimeState && flushRuntimeState) {
        await runStage('flushRuntimeState', () => flushRuntimeState(runtimeState));
      }

      const currentAlerts = [...momentumAlerts]
        .sort(compareSignalPriority)
        .slice(0, maxAlertsPerRound);

      const result = await runStage('buildLocalResult', () =>
        buildLocalResult({
          currentAlerts,
          dashboardRows,
          rowLimit,
          scannedAt,
          scannedAtTs,
          tokens,
        })
      );

      result.pushed = await runStage('deliverAlerts', () => deliverAlerts(currentAlerts, deliver));

      return result;
    } finally {
    }
  }

  async function processNarrativeStates(tokens, db, runtimeState) {
    for (const token of tokens) {
      if (await isTokenSeen(db, token.address, runtimeState)) {
        runtimeState?.touchedTokenAddresses?.add(token.address);
        const theme = normalizeTheme(token.name, token.symbol);
        await recordToken(
          db,
          token.address,
          token.chain,
          token.name,
          token.symbol,
          theme,
          classifyNarrative(token.name, token.symbol, token.chain)[0],
          token.mc,
          false,
          runtimeState
        );

        if (theme && runtimeState?.narratives.has(theme)) {
          const narrative = runtimeState.narratives.get(theme);
          const updated = {
            ...narrative,
            tokenCount: Number(narrative.tokenCount || 0) + 1,
            lastSeenAt: Math.floor(Date.now() / 1000),
          };
          runtimeState.narratives.set(theme, updated);
          narrativesRuntime.set(theme, updated);
          runtimeState.touchedNarrativeThemes?.add(theme);
        }
        continue;
      }

      const [category] = classifyNarrative(token.name, token.symbol, token.chain);
      if (category === 'spam') {
        runtimeState?.touchedTokenAddresses?.add(token.address);
        await recordToken(
          db,
          token.address,
          token.chain,
          token.name,
          token.symbol,
          '',
          'spam',
          token.mc,
          false,
          runtimeState
        );
        continue;
      }

      if (token.mc < minMarketCap || token.liq < minLiquidity) {
        runtimeState?.touchedTokenAddresses?.add(token.address);
        await recordToken(
          db,
          token.address,
          token.chain,
          token.name,
          token.symbol,
          '',
          'too_small',
          token.mc,
          false,
          runtimeState
        );
        continue;
      }

      const theme = normalizeTheme(token.name, token.symbol);
      runtimeState?.touchedTokenAddresses?.add(token.address);
      await recordToken(
        db,
        token.address,
        token.chain,
        token.name,
        token.symbol,
        theme,
        category,
        token.mc,
        false,
        runtimeState
      );
      const [, narrativeState] = await checkNarrativeNovelty(
        db,
        theme,
        token.name,
        token.address,
        token.chain,
        runtimeState
      );
      if (narrativeState?.theme) {
        runtimeState?.touchedNarrativeThemes?.add(narrativeState.theme);
      } else if (theme) {
        runtimeState?.touchedNarrativeThemes?.add(theme);
      }
    }
  }

  async function buildLocalResult({
    currentAlerts,
    dashboardRows,
    rowLimit,
    scannedAt,
    scannedAtTs,
    tokens,
  }) {
    if (!buildDrizzleLocalResult) {
      throw new Error('本地查询旧 fallback 已移除，请接入 Drizzle local result builder');
    }
    return buildDrizzleLocalResult({
      currentAlerts,
      dashboardRows,
      rowLimit,
      scannedAt,
      scannedAtTs,
      tokens,
    });
  }

  async function deliverAlerts(currentAlerts, deliver) {
    let pushed = 0;
    if (!deliver) {
      return pushed;
    }
    for (const alert of currentAlerts) {
      if (await tgSend(alert.msg)) {
        pushed += 1;
        await sleep(1_000);
      }
    }
    return pushed;
  }

  return {
    scanNarratives,
  };
}
