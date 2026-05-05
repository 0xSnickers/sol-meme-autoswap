import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(os.homedir(), '.env'), override: false });
dotenv.config({ override: false });

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return '';
  }
  return process.argv[index + 1] || '';
}

const driverArg = String(getArgValue('--driver') || '').toLowerCase();
if (driverArg === 'sqlite' || driverArg === 'supabase') {
  process.env.SIGNAL_STORAGE_DRIVER = driverArg;
  process.env.RADAR_STORAGE_DRIVER = driverArg;
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RETENTION_DAYS = Math.max(
  1,
  Number(process.env.SIGNAL_DATA_RETENTION_DAYS || process.env.RADAR_DATA_RETENTION_DAYS || 15)
);
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;
const NON_POSITION_RUNTIME_TYPES = ['momentum_tracker', 'momentum_pushed', 'token_seen', 'narrative'];

function createSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，无法执行清理任务');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
  });
}

async function deleteAlerts(supabase, thresholdTs) {
  const { data, error } = await supabase
    .from('radar_alerts')
    .delete()
    .lt('pushed_at', thresholdTs)
    .select('id');

  if (error) {
    throw new Error(`清理 radar_alerts 失败: ${error.message}`);
  }

  return data?.length || 0;
}

async function deleteClosedPositions(supabase, thresholdTs) {
  const { data, error } = await supabase
    .from('radar_positions')
    .delete()
    .eq('status', 'closed')
    .lt('closed_at', thresholdTs)
    .select('id');

  if (error) {
    throw new Error(`清理 radar_positions 失败: ${error.message}`);
  }

  return data?.length || 0;
}

async function deleteRuntimeStateRows(supabase, thresholdTs) {
  const { data, error } = await supabase
    .from('radar_runtime_state')
    .delete()
    .in('state_type', NON_POSITION_RUNTIME_TYPES)
    .lt('updated_at', thresholdTs)
    .select('state_key');

  if (error) {
    throw new Error(`清理 radar_runtime_state 运行态失败: ${error.message}`);
  }

  return data?.length || 0;
}

async function deleteClosedPositionRuntimeState(supabase, thresholdTs) {
  const { data, error } = await supabase
    .from('radar_runtime_state')
    .select('state_key, payload')
    .eq('state_type', 'paper_position')
    .lt('updated_at', thresholdTs);

  if (error) {
    throw new Error(`读取 paper_position 运行态失败: ${error.message}`);
  }

  const expiredClosedKeys = (data || [])
    .filter((row) => String(row?.payload?.status || '') === 'closed')
    .map((row) => row.state_key)
    .filter(Boolean);

  if (expiredClosedKeys.length === 0) {
    return 0;
  }

  let deletedCount = 0;
  for (let index = 0; index < expiredClosedKeys.length; index += 200) {
    const batch = expiredClosedKeys.slice(index, index + 200);
    const { data: deletedRows, error: deleteError } = await supabase
      .from('radar_runtime_state')
      .delete()
      .in('state_key', batch)
      .select('state_key');

    if (deleteError) {
      throw new Error(`清理已平仓 paper_position 运行态失败: ${deleteError.message}`);
    }

    deletedCount += deletedRows?.length || 0;
  }

  return deletedCount;
}

async function writeCleanupMeta(supabase, summary) {
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from('radar_meta').upsert(
    [
      { key: 'last_cleanup_at', value: nowIso },
      { key: 'last_cleanup_summary', value: JSON.stringify(summary) },
    ],
    { onConflict: 'key' }
  );

  if (error) {
    throw new Error(`写入 cleanup meta 失败: ${error.message}`);
  }
}

async function main() {
  const driver = String(
    process.env.SIGNAL_STORAGE_DRIVER || process.env.RADAR_STORAGE_DRIVER || 'auto'
  ).toLowerCase();

  if (driver === 'sqlite') {
    console.log('[cleanup] 当前为 sqlite 模式，不执行远端保留期清理；如需清空测试数据，请使用 npm run signal:reset:sqlite');
    return;
  }

  const supabase = createSupabase();
  const nowTs = Math.floor(Date.now() / 1000);
  const thresholdTs = nowTs - RETENTION_SECONDS;

  console.log(`[cleanup] 开始执行，保留 ${RETENTION_DAYS} 天，阈值时间戳 ${thresholdTs}`);

  const deletedAlerts = await deleteAlerts(supabase, thresholdTs);
  const deletedClosedPositions = await deleteClosedPositions(supabase, thresholdTs);
  const deletedRuntimeState = await deleteRuntimeStateRows(supabase, thresholdTs);
  const deletedClosedPositionState = await deleteClosedPositionRuntimeState(supabase, thresholdTs);

  const summary = {
    retentionDays: RETENTION_DAYS,
    thresholdTs,
    deletedAlerts,
    deletedClosedPositions,
    deletedRuntimeState,
    deletedClosedPositionState,
  };

  await writeCleanupMeta(supabase, summary);

  console.log('[cleanup] 执行完成');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(`[cleanup] 执行失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
