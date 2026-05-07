import '../../../lib/signal-env.js';
import path from 'node:path';
import { createPostgresDrizzleClient } from './postgres.js';
import { createSqliteDrizzleClient } from './sqlite.js';

let cachedDrizzleClient = null;

export function resolveSignalDbDriver(env = process.env) {
  const explicitDriver = String(env.SIGNAL_DB_DRIVER || env.RADAR_DB_DRIVER || '').toLowerCase();
  if (explicitDriver === 'postgres' || explicitDriver === 'postgresql') {
    return 'postgres';
  }
  if (explicitDriver === 'sqlite') {
    return 'sqlite';
  }

  const storageDriver = String(env.SIGNAL_STORAGE_DRIVER || env.RADAR_STORAGE_DRIVER || '').toLowerCase();
  if (storageDriver === 'postgres' || storageDriver === 'postgresql') {
    return 'postgres';
  }

  return 'sqlite';
}

export function resolveSqliteDatabasePath(env = process.env) {
  const explicitPath = env.SIGNAL_SQLITE_PATH || env.RADAR_SQLITE_PATH;
  if (explicitPath) {
    return explicitPath;
  }

  const dataDir = env.SIGNAL_DATA_DIR || env.RADAR_DATA_DIR || '.signal-scan-data';
  return path.join(process.cwd(), dataDir, 'narrative_history.db');
}

export function resolvePostgresConnectionString(env = process.env) {
  return (
    env.SIGNAL_DATABASE_URL ||
    env.RADAR_DATABASE_URL ||
    env.POSTGRES_URL ||
    env.DATABASE_URL ||
    ''
  );
}

export function createDrizzleClient({ env = process.env } = {}) {
  const driver = resolveSignalDbDriver(env);
  if (driver === 'postgres') {
    const connectionString = resolvePostgresConnectionString(env);
    if (!connectionString) {
      throw new Error('当前数据库驱动为 postgres，但未配置 SIGNAL_DATABASE_URL / POSTGRES_URL');
    }
    return createPostgresDrizzleClient({ connectionString });
  }

  return createSqliteDrizzleClient({
    filePath: resolveSqliteDatabasePath(env),
  });
}

export function getDrizzleClient({ env = process.env, forceNew = false } = {}) {
  if (forceNew || !cachedDrizzleClient) {
    cachedDrizzleClient = createDrizzleClient({ env });
  }
  return cachedDrizzleClient;
}

export function getDrizzleDb(options) {
  return getDrizzleClient(options).db;
}
