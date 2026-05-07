export function createRuntimeStateService({
  isSimilarTheme,
  momentumPushed,
  momentumTracker,
  narrativesRuntime,
  tokensSeenRuntime,
  repositories = null,
}) {
  function applyRuntimeStateMaps(runtimeState) {
    momentumTracker.clear();
    momentumPushed.clear();
    tokensSeenRuntime.clear();
    narrativesRuntime.clear();

    if (!runtimeState) {
      return;
    }

    for (const [address, snapshots] of runtimeState.momentumTracker.entries()) {
      momentumTracker.set(address, snapshots);
    }
    for (const [address, info] of runtimeState.momentumPushed.entries()) {
      momentumPushed.set(address, info);
    }
    for (const [address, tokenState] of runtimeState.tokensSeen.entries()) {
      tokensSeenRuntime.set(address, tokenState);
    }
    for (const [theme, narrativeState] of runtimeState.narratives.entries()) {
      narrativesRuntime.set(theme, narrativeState);
    }
  }

  async function isTokenSeen(_db, address, runtimeState = null) {
    if (runtimeState) {
      return runtimeState.tokensSeen.has(address);
    }

    return Boolean(await repositories?.tokensSeen?.findByAddress(address));
  }

  async function recordToken(
    _db,
    address,
    chain,
    name,
    symbol,
    theme,
    category,
    marketCap,
    pushed = false,
    runtimeState = null
  ) {
    if (runtimeState) {
      const now = Math.floor(Date.now() / 1000);
      const existing = runtimeState.tokensSeen.get(address);
      if (existing) {
        runtimeState.tokensSeen.set(address, {
          ...existing,
          seenCount: (existing.seenCount || 0) + 1,
          marketCap,
          category,
          updatedAt: now,
        });
        tokensSeenRuntime.set(address, runtimeState.tokensSeen.get(address));
        return;
      }

      const payload = {
        address,
        chain,
        name,
        symbol,
        theme,
        category,
        firstSeenAt: now,
        marketCap,
        pushed: Boolean(pushed),
        seenCount: 1,
        updatedAt: now,
      };
      runtimeState.tokensSeen.set(address, payload);
      tokensSeenRuntime.set(address, payload);
      return;
    }

    const existing = await repositories?.tokensSeen?.findByAddress(address);
    if (existing) {
      await repositories.tokensSeen.updateByAddress(address, {
        seenCount: Number(existing.seenCount || 0) + 1,
        marketCap,
        category,
        narrativeTheme: theme,
        pushed: pushed ? 1 : Number(existing.pushed || 0),
      });
      return;
    }

    await repositories?.tokensSeen?.insert({
      address,
      chain,
      name,
      symbol,
      narrativeTheme: theme,
      category,
      firstSeenAt: Math.floor(Date.now() / 1000),
      marketCap,
      pushed: pushed ? 1 : 0,
      seenCount: 1,
    });
  }

  async function checkNarrativeNovelty(_db, theme, name, address, chain, runtimeState = null) {
    const now = Math.floor(Date.now() / 1000);
    const heatWindow = 1800;
    const heatThreshold = 2;

    if (runtimeState) {
      const exact = runtimeState.narratives.get(theme);
      if (exact) {
        const updated = {
          ...exact,
          tokenCount: (exact.tokenCount || 0) + 1,
          lastSeenAt: now,
        };
        runtimeState.narratives.set(theme, updated);
        narrativesRuntime.set(theme, updated);

        if (
          (now - updated.firstSeenAt < heatWindow && updated.tokenCount >= heatThreshold) ||
          (now - Number(exact.lastSeenAt || 0) < heatWindow && updated.tokenCount >= heatThreshold)
        ) {
          return ['heating', updated];
        }

        return ['existing', updated];
      }

      const recentThemes = [...runtimeState.narratives.values()]
        .sort((left, right) => Number(right.lastSeenAt || 0) - Number(left.lastSeenAt || 0))
        .slice(0, 1000);

      for (const row of recentThemes) {
        if (!isSimilarTheme(theme, row.theme)) {
          continue;
        }

        const updated = {
          ...row,
          tokenCount: (row.tokenCount || 0) + 1,
          lastSeenAt: now,
        };
        runtimeState.narratives.delete(row.theme);
        runtimeState.narratives.set(row.theme, updated);
        narrativesRuntime.set(row.theme, updated);

        if (now - Number(row.lastSeenAt || 0) < heatWindow && updated.tokenCount >= heatThreshold) {
          return ['heating', updated];
        }

        return ['existing', updated];
      }

      const payload = {
        theme,
        firstTokenName: name,
        firstTokenAddress: address,
        firstChain: chain,
        firstSeenAt: now,
        tokenCount: 1,
        lastSeenAt: now,
      };
      runtimeState.narratives.set(theme, payload);
      narrativesRuntime.set(theme, payload);
      return ['novel', null];
    }

    const exact = await repositories?.narratives?.findByTheme(theme);
    if (exact) {
      const nextTokenCount = Number(exact.tokenCount || 0) + 1;
      await repositories.narratives.updateById(exact.id, {
        tokenCount: nextTokenCount,
        lastSeenAt: now,
      });

      if (
        (now - Number(exact.firstSeenAt || 0) < heatWindow && nextTokenCount >= heatThreshold) ||
        (now - Number(exact.lastSeenAt || 0) < heatWindow && nextTokenCount >= heatThreshold)
      ) {
        return ['heating', exact];
      }

      return ['existing', exact];
    }

    const recentThemes = await repositories?.narratives?.listRecent(1000);
    for (const row of recentThemes || []) {
      if (!isSimilarTheme(theme, row.theme)) {
        continue;
      }

      const nextTokenCount = Number(row.tokenCount || 0) + 1;
      await repositories.narratives.updateById(row.id, {
        tokenCount: nextTokenCount,
        lastSeenAt: now,
      });

      if (now - Number(row.lastSeenAt || 0) < heatWindow && nextTokenCount >= heatThreshold) {
        return ['heating', row];
      }

      return ['existing', row];
    }

    await repositories?.narratives?.insert({
      theme,
      firstTokenName: name,
      firstTokenAddress: address,
      firstChain: chain,
      firstSeenAt: now,
      tokenCount: 1,
      lastSeenAt: now,
    });

    return ['novel', null];
  }

  return {
    applyRuntimeStateMaps,
    checkNarrativeNovelty,
    isTokenSeen,
    recordToken,
  };
}
