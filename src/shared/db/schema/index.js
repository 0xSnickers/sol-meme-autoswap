import {
  postgresRadarAlerts,
  postgresRadarMeta,
  postgresRadarNarratives,
  postgresRadarPositions,
  postgresRadarRuntimeState,
  postgresRadarTradeIntents,
  postgresRadarTokensSeen,
} from './postgres-schema.js';
import {
  sqliteNarratives,
  sqlitePaperPositions,
  sqlitePushedAlerts,
  sqliteRadarMeta,
  sqliteTokensSeen,
  sqliteTradeIntents,
} from './sqlite-schema.js';

export function getDrizzleSchema(driver = 'sqlite') {
  if (driver === 'postgres') {
    return {
      dialect: 'postgres',
      meta: postgresRadarMeta,
      alerts: postgresRadarAlerts,
      positions: postgresRadarPositions,
      runtimeState: postgresRadarRuntimeState,
      tradeIntents: postgresRadarTradeIntents,
      narratives: postgresRadarNarratives,
      tokensSeen: postgresRadarTokensSeen,
    };
  }

  return {
    dialect: 'sqlite',
    meta: sqliteRadarMeta,
    alerts: sqlitePushedAlerts,
    positions: sqlitePaperPositions,
    tradeIntents: sqliteTradeIntents,
    narratives: sqliteNarratives,
    tokensSeen: sqliteTokensSeen,
  };
}

export {
  postgresRadarAlerts,
  postgresRadarMeta,
  postgresRadarNarratives,
  postgresRadarPositions,
  postgresRadarRuntimeState,
  postgresRadarTradeIntents,
  postgresRadarTokensSeen,
  sqliteNarratives,
  sqlitePaperPositions,
  sqlitePushedAlerts,
  sqliteRadarMeta,
  sqliteTokensSeen,
  sqliteTradeIntents,
};
