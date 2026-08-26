import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(os.homedir(), '.env'), override: false, quiet: true });
dotenv.config({ override: false, quiet: true });

const mode = process.argv[2];
if (mode !== 'dev' && mode !== 'start') {
  console.error('用法: node scripts/web/run.js <dev|start>');
  process.exit(1);
}

const extraArgs = process.argv.slice(3);
const hasPortArg = extraArgs.some((arg) => arg === '-p' || arg === '--port' || arg.startsWith('--port='));
const configuredPort = Number(process.env.PORT || process.env.SIGNAL_WEB_PORT || 3000);

if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65_535) {
  console.error(`无效 Web 端口: ${process.env.PORT || process.env.SIGNAL_WEB_PORT}`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const nextCliPath = require.resolve('next/dist/bin/next');
const args = [nextCliPath, mode];
if (!hasPortArg) {
  args.push('--port', String(configuredPort));
}
args.push(...extraArgs);

const child = spawn(process.execPath, args, {
  env: process.env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Web 服务启动失败: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
