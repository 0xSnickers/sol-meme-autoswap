export {
  formatDecisionLabel,
  formatDuration,
  formatMoney,
  formatPercent,
  formatPrice,
  formatTime,
  formatUsd,
  formatUsdValue,
} from '../../src/modules/signals/lib/signal-formatters.js';

export function formatTokenAmount(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    notation: value >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 2 : 4,
  }).format(Number(value));
}
