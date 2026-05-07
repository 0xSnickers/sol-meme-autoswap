import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { createDrizzleClient, resolveSignalDbDriver } from '../../src/shared/db/client/index.js';

dotenv.config({ path: path.join(os.homedir(), '.env'), override: false });
dotenv.config({ override: false });

const DEFAULT_SQLITE_DIR = path.join(process.cwd(), '.signal-scan-data');
const LEGACY_SQLITE_DIR = path.join(process.cwd(), '.radar-data');

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return '';
  }
  return process.argv[index + 1] || '';
}

function resolveDriver() {
  const raw = getArgValue('--driver') || process.env.SIGNAL_DB_DRIVER || process.env.RADAR_DB_DRIVER || 'both';
  const normalized = String(raw).toLowerCase();
  return ['sqlite', 'postgres', 'both'].includes(normalized) ? normalized : 'both';
}

function getSqliteDirs() {
  const configuredDir =
    process.env.SIGNAL_DATA_DIR ||
    process.env.RADAR_DATA_DIR ||
    DEFAULT_SQLITE_DIR;

  return [...new Set([configuredDir, DEFAULT_SQLITE_DIR, LEGACY_SQLITE_DIR])].filter(Boolean);
}

function resetSqliteData() {
  const deletedPaths = [];
  for (const targetPath of getSqliteDirs()) {
    const absolutePath = path.isAbsolute(targetPath)
      ? targetPath
      : path.join(process.cwd(), targetPath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    fs.rmSync(absolutePath, { recursive: true, force: true });
    deletedPaths.push(absolutePath);
  }
  return {
    driver: 'sqlite',
    deletedPaths,
  };
}

async function resetPostgresData() {
  const drizzleClient = createDrizzleClient({
    env: {
      ...process.env,
      SIGNAL_DB_DRIVER: 'postgres',
    },
  });

  try {
    await drizzleClient.client.unsafe(`
      TRUNCATE TABLE
        radar_runtime_state,
        radar_trade_intents,
        radar_positions,
        radar_alerts,
        radar_tokens_seen,
        radar_narratives,
        radar_meta
      RESTART IDENTITY
      CASCADE
    `);

    return {
      driver: 'postgres',
      truncatedTables: [
        'radar_runtime_state',
        'radar_trade_intents',
        'radar_positions',
        'radar_alerts',
        'radar_tokens_seen',
        'radar_narratives',
        'radar_meta',
      ],
    };
  } finally {
    await drizzleClient.client.end({ timeout: 5 });
  }
}

async function main() {
  const driver = resolveDriver();
  const summary = [];

  const currentDriver = resolveSignalDbDriver();
  const effectiveDriver = driver === 'both' ? currentDriver : driver;

  if (effectiveDriver === 'sqlite' || driver === 'both') {
    summary.push(resetSqliteData());
  }

  if (effectiveDriver === 'postgres' || driver === 'both') {
    summary.push(await resetPostgresData());
  }

  console.log('[reset] 已完成测试数据重置');
  console.log(JSON.stringify({ driver, summary }, null, 2));
}

main().catch((error) => {
  console.error(`[reset] 执行失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
