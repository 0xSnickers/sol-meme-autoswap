import { getDrizzleClient } from '../client/index.js';
import { createNarrativeRepository } from './narrative-repository.js';
import { createRadarAlertRepository } from './radar-alert-repository.js';
import { createRadarMetaRepository } from './radar-meta-repository.js';
import { createRadarPositionRepository } from './radar-position-repository.js';
import { createTokenSeenRepository } from './token-seen-repository.js';
import { createTradeIntentRepository } from './trade-intent-repository.js';

export function createRadarRepositories(options = {}) {
  const drizzleClient = options.drizzleClient || getDrizzleClient(options);
  const shared = {
    db: drizzleClient.db,
    schema: drizzleClient.schema,
  };

  return {
    drizzleClient,
    meta: createRadarMetaRepository(shared),
    alerts: createRadarAlertRepository(shared),
    positions: createRadarPositionRepository(shared),
    tradeIntents: createTradeIntentRepository(shared),
    narratives: createNarrativeRepository(shared),
    tokensSeen: createTokenSeenRepository(shared),
  };
}
