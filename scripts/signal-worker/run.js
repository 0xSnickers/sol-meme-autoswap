import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

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

const scanIntervalSeconds = Number(
  process.env.SIGNAL_SCAN_INTERVAL || process.env.RADAR_SCAN_INTERVAL || 30
);
const rowLimit = Number(
  process.env.SIGNAL_SCAN_ROW_LIMIT || process.env.RADAR_TELEGRAM_ROW_LIMIT || 60
);
const runOnce = process.argv.includes('--once');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRound() {
  const { scanSignals } = await import('../../src/signal-scanner.js');
  const startedAt = Date.now();
  const result = await scanSignals({
    deliver: true,
    rowLimit,
  });

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `[signal-worker] 扫描完成: driver=${process.env.SIGNAL_STORAGE_DRIVER || process.env.RADAR_STORAGE_DRIVER || 'auto'} scanned=${result.scanned} found=${result.found} pushed=${result.pushed} elapsed=${elapsedMs}ms`
  );
}

async function main() {
  if (runOnce) {
    await runRound();
    return;
  }

  while (true) {
    const startedAt = Date.now();

    try {
      await runRound();
    } catch (error) {
      console.error(
        `[signal-worker] 扫描失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const elapsedMs = Date.now() - startedAt;
    const waitMs = Math.max(0, scanIntervalSeconds * 1000 - elapsedMs);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }
}

main().catch((error) => {
  console.error(
    `[signal-worker] 运行失败: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
