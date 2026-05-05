import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(os.homedir(), '.env'), override: false });
dotenv.config({ override: false });

const DEFAULT_SQLITE_DIR = path.join(process.cwd(), '.signal-scan-data');
const LEGACY_SQLITE_DIR = path.join(process.cwd(), '.radar-data');
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return '';
  }
  return process.argv[index + 1] || '';
}

function resolveDriver() {
  const raw =
    getArgValue('--driver') ||
    process.env.SIGNAL_STORAGE_DRIVER ||
    process.env.RADAR_STORAGE_DRIVER ||
    'both';
  const normalized = String(raw).toLowerCase();
  return ['sqlite', 'supabase', 'both'].includes(normalized) ? normalized : 'both';
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

function createSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，无法重置 Supabase 数据');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: process.env.SUPABASE_SCHEMA || 'public',
    },
  });
}

async function deleteRowsInBatches({ supabase, table, keyColumn, selectColumns = keyColumn, batchSize = 1000 }) {
  let deletedCount = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(selectColumns)
      .order(keyColumn, { ascending: true })
      .limit(batchSize);

    if (error) {
      throw new Error(`读取 ${table} 失败: ${error.message}`);
    }

    const rows = data || [];
    if (!rows.length) {
      break;
    }

    const keys = rows.map((row) => row[keyColumn]).filter(Boolean);
    if (!keys.length) {
      break;
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from(table)
      .delete()
      .in(keyColumn, keys)
      .select(keyColumn);

    if (deleteError) {
      throw new Error(`删除 ${table} 失败: ${deleteError.message}`);
    }

    deletedCount += deletedRows?.length || 0;

    if (rows.length < batchSize) {
      break;
    }
  }

  return deletedCount;
}

async function resetSupabaseData() {
  const supabase = createSupabase();

  const deletedAlerts = await deleteRowsInBatches({
    supabase,
    table: 'radar_alerts',
    keyColumn: 'id',
  });
  const deletedPositions = await deleteRowsInBatches({
    supabase,
    table: 'radar_positions',
    keyColumn: 'id',
  });
  const deletedRuntimeState = await deleteRowsInBatches({
    supabase,
    table: 'radar_runtime_state',
    keyColumn: 'state_key',
  });
  const deletedMeta = await deleteRowsInBatches({
    supabase,
    table: 'radar_meta',
    keyColumn: 'key',
  });

  return {
    driver: 'supabase',
    deletedAlerts,
    deletedPositions,
    deletedRuntimeState,
    deletedMeta,
  };
}

async function main() {
  const driver = resolveDriver();
  const summary = [];

  if (driver === 'sqlite' || driver === 'both') {
    summary.push(resetSqliteData());
  }

  if (driver === 'supabase' || driver === 'both') {
    summary.push(await resetSupabaseData());
  }

  console.log('[reset] 已完成测试数据重置');
  console.log(JSON.stringify({ driver, summary }, null, 2));
}

main().catch((error) => {
  console.error(`[reset] 执行失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
