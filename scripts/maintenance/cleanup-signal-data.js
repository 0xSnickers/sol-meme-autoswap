import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { createDrizzleClient, resolveSignalDbDriver } from '../../src/shared/db/client/index.js';

dotenv.config({ path: path.join(os.homedir(), '.env'), override: false });
dotenv.config({ override: false });

const RETENTION_DAYS = Math.max(
  1,
  Number(process.env.SIGNAL_DATA_RETENTION_DAYS || process.env.RADAR_DATA_RETENTION_DAYS || 15)
);
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;
const NON_POSITION_RUNTIME_TYPES = ['momentum_tracker', 'momentum_pushed', 'token_seen', 'narrative'];

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return '';
  }
  return process.argv[index + 1] || '';
}

function resolveDriver() {
  const raw = getArgValue('--driver') || process.env.SIGNAL_DB_DRIVER || process.env.RADAR_DB_DRIVER || '';
  const normalized = String(raw).toLowerCase();
  if (normalized === 'sqlite' || normalized === 'postgres') {
    return normalized;
  }
  return resolveSignalDbDriver();
}

function cleanupSqliteData(client, thresholdTs, summary) {
  const deleteAlerts = client.prepare('DELETE FROM pushed_alerts WHERE pushed_at < ?').run(thresholdTs);
  const deleteClosedPositions = client
    .prepare("DELETE FROM paper_positions WHERE status = 'closed' AND closed_at IS NOT NULL AND closed_at < ?")
    .run(thresholdTs);
  const deleteTradeIntents = client
    .prepare('DELETE FROM trade_intents WHERE created_at < ?')
    .run(thresholdTs);
  const deleteNarratives = client
    .prepare('DELETE FROM narratives WHERE last_seen_at < ?')
    .run(thresholdTs);
  const deleteTokensSeen = client
    .prepare('DELETE FROM tokens_seen WHERE first_seen_at < ? AND pushed = 0')
    .run(thresholdTs);
  client
    .prepare(`
      INSERT INTO radar_meta (key, value)
      VALUES (?, ?), (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(
      'last_cleanup_at',
      new Date().toISOString(),
      'last_cleanup_summary',
      JSON.stringify(summary)
    );

  return {
    deletedAlerts: deleteAlerts.changes || 0,
    deletedClosedPositions: deleteClosedPositions.changes || 0,
    deletedTradeIntents: deleteTradeIntents.changes || 0,
    deletedNarratives: deleteNarratives.changes || 0,
    deletedTokensSeen: deleteTokensSeen.changes || 0,
  };
}

async function cleanupPostgresData(client, thresholdTs, summary) {
  const deletedAlerts = await client`
    DELETE FROM radar_alerts
    WHERE pushed_at < ${thresholdTs}
  `;
  const deletedClosedPositions = await client`
    DELETE FROM radar_positions
    WHERE status = 'closed'
      AND closed_at IS NOT NULL
      AND closed_at < ${thresholdTs}
  `;
  const deletedTradeIntents = await client`
    DELETE FROM radar_trade_intents
    WHERE created_at < ${thresholdTs}
  `;
  const deletedRuntimeState = await client`
    DELETE FROM radar_runtime_state
    WHERE state_type = ANY(${NON_POSITION_RUNTIME_TYPES})
      AND updated_at < ${thresholdTs}
  `;
  const deletedClosedPositionState = await client`
    DELETE FROM radar_runtime_state
    WHERE state_type = 'paper_position'
      AND updated_at < ${thresholdTs}
      AND payload->>'status' = 'closed'
  `;
  const deletedNarratives = await client`
    DELETE FROM radar_narratives
    WHERE last_seen_at < ${thresholdTs}
  `;
  const deletedTokensSeen = await client`
    DELETE FROM radar_tokens_seen
    WHERE first_seen_at < ${thresholdTs}
      AND pushed = 0
  `;
  await client`
    INSERT INTO radar_meta (key, value)
    VALUES
      ('last_cleanup_at', ${new Date().toISOString()}),
      ('last_cleanup_summary', ${JSON.stringify(summary)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  return {
    deletedAlerts: deletedAlerts.count || 0,
    deletedClosedPositions: deletedClosedPositions.count || 0,
    deletedTradeIntents: deletedTradeIntents.count || 0,
    deletedRuntimeState: deletedRuntimeState.count || 0,
    deletedClosedPositionState: deletedClosedPositionState.count || 0,
    deletedNarratives: deletedNarratives.count || 0,
    deletedTokensSeen: deletedTokensSeen.count || 0,
  };
}

async function main() {
  const driver = resolveDriver();
  const thresholdTs = Math.floor(Date.now() / 1000) - RETENTION_SECONDS;
  const drizzleClient = createDrizzleClient({
    env: {
      ...process.env,
      SIGNAL_DB_DRIVER: driver,
    },
  });

  const summary = {
    driver,
    retentionDays: RETENTION_DAYS,
    thresholdTs,
  };

  try {
    const cleanupSummary =
      driver === 'sqlite'
        ? cleanupSqliteData(drizzleClient.client, thresholdTs, summary)
        : await cleanupPostgresData(drizzleClient.client, thresholdTs, summary);

    const result = {
      ...summary,
      ...cleanupSummary,
    };

    console.log('[cleanup] 执行完成');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (driver === 'sqlite') {
      drizzleClient.client.close();
    } else {
      await drizzleClient.client.end({ timeout: 5 });
    }
  }
}

main().catch((error) => {
  console.error(`[cleanup] 执行失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
