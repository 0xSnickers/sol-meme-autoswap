export function createRuntimeTrackers() {
  return {
    momentumTracker: new Map(),
    momentumPushed: new Map(),
    tokensSeenRuntime: new Map(),
    narrativesRuntime: new Map(),
  };
}

export function createGmgnHeaders() {
  return {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    Accept: 'application/json',
    Referer: 'https://gmgn.ai/',
  };
}

export function isFileLoggingEnabled({ env = process.env } = {}) {
  return String(env.RADAR_FILE_LOG_ENABLED || 'true').toLowerCase() !== 'false';
}
