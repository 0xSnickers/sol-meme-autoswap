'use client';

import { useEffect, useState } from 'react';
import { withAppBasePath } from '../../src/lib/app-path.js';

export const CHAIN_OPTIONS = [
  { value: 'sol', label: 'Solana', shortLabel: 'SOL', iconSrc: withAppBasePath('/chains/solana.jpg') },
  { value: 'bsc', label: 'BNB Chain', shortLabel: 'BNB', iconSrc: withAppBasePath('/chains/bnb.jpg') },
  { value: 'base', label: 'Base', shortLabel: 'BASE', iconSrc: withAppBasePath('/chains/ethereum.jpg') },
];

export function getSelectedChainLabel(chain) {
  return CHAIN_OPTIONS.find((option) => option.value === chain)?.label || chain.toUpperCase();
}

const STORAGE_KEY = 'selected-signal-chain';

export function useSelectedChain() {
  const [selectedChain, setSelectedChain] = useState('sol');

  useEffect(() => {
    const savedChain = window.localStorage.getItem(STORAGE_KEY);
    if (CHAIN_OPTIONS.some((option) => option.value === savedChain)) {
      setSelectedChain(savedChain);
    }
  }, []);

  function selectChain(chain) {
    setSelectedChain(chain);
    window.localStorage.setItem(STORAGE_KEY, chain);
  }

  return [selectedChain, selectChain];
}

function total(rows, getValue) {
  return rows.reduce((sum, row) => sum + Number(getValue(row) || 0), 0);
}

export function buildChainPaperSummary(baseSummary, openPositions, closedPositions) {
  const totalCapitalUsd = Number(baseSummary?.totalCapitalUsd || 0);
  const openCostUsd = total(openPositions, (row) => row.remainingPositionSizeUsd ?? row.positionSizeUsd);
  const openValueUsd = total(openPositions, (row) => row.currentValueUsd);
  const openPnLUsd = total(openPositions, (row) => row.pnlUsd);
  const closedCostUsd = total(closedPositions, (row) => row.positionSizeUsd);
  const closedValueUsd = total(
    closedPositions,
    (row) => row.realizedProceedsUsd ?? Number(row.positionSizeUsd || 0) + Number(row.pnlUsd || 0)
  );
  const closedPnLUsd = total(closedPositions, (row) => row.realizedPnlUsd ?? row.pnlUsd);
  const availableUsd = totalCapitalUsd - openCostUsd + closedValueUsd;

  return {
    ...baseSummary,
    openCount: openPositions.length,
    closedCount: closedPositions.length,
    openCostUsd,
    openValueUsd,
    openPnLUsd,
    closedCostUsd,
    closedValueUsd,
    closedPnLUsd,
    availableUsd,
    equityUsd: availableUsd + openValueUsd,
    capitalUsagePct: totalCapitalUsd > 0 ? (openCostUsd / totalCapitalUsd) * 100 : 0,
    totalPnLUsd: openPnLUsd + closedPnLUsd,
  };
}
