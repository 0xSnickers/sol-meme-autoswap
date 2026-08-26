const CHAIN_DEFINITIONS = Object.freeze({
  sol: Object.freeze({ id: 'sol', label: 'Solana', shortLabel: 'SOL', gmgnSlug: 'sol' }),
  bsc: Object.freeze({ id: 'bsc', label: 'BNB Chain', shortLabel: 'BNB', gmgnSlug: 'bsc' }),
  base: Object.freeze({ id: 'base', label: 'Base', shortLabel: 'BASE', gmgnSlug: 'base' }),
});

const CHAIN_ALIASES = Object.freeze({ solana: 'sol', bnb: 'bsc', 'bnb-chain': 'bsc' });

export const DEFAULT_SIGNAL_CHAINS = Object.freeze(['sol', 'bsc', 'base']);

export function normalizeSignalChain(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return CHAIN_ALIASES[normalized] || normalized;
}

export function resolveSignalChains(value) {
  const requested = Array.isArray(value) ? value : String(value || '').split(',');
  const chains = requested
    .map(normalizeSignalChain)
    .filter((chain, index, items) => CHAIN_DEFINITIONS[chain] && items.indexOf(chain) === index);
  return chains.length > 0 ? chains : [...DEFAULT_SIGNAL_CHAINS];
}

export function getConfiguredSignalChains(env = process.env) {
  return resolveSignalChains(env.SIGNAL_CHAINS || env.RADAR_CHAINS);
}

export function getSignalChainDefinition(chain) {
  const normalized = normalizeSignalChain(chain);
  return CHAIN_DEFINITIONS[normalized] || {
    id: normalized,
    label: normalized.toUpperCase(),
    shortLabel: normalized.toUpperCase(),
    gmgnSlug: normalized,
  };
}

export function getSignalChainKey(chain, address) {
  return `${normalizeSignalChain(chain)}:${String(address || '').toLowerCase()}`;
}

export function getGmgnTokenUrl(chain, address) {
  return `https://gmgn.ai/${getSignalChainDefinition(chain).gmgnSlug}/token/${address}`;
}

export function formatSignalChainList(chains) {
  return resolveSignalChains(chains)
    .map((chain) => getSignalChainDefinition(chain).shortLabel)
    .join(' / ');
}
