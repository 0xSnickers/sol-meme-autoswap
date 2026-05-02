import 'dotenv/config';
import { execa } from 'execa';

if (!process.env.GMGN_API_KEY) {
  console.error('缺少 GMGN_API_KEY，请先检查 .env 配置。');
  process.exit(1);
}

try {
  const { stdout } = await execa(
    'gmgn-cli',
    [
      'market',
      'trending',
      '--chain',
      'sol',
      '--interval',
      '1h',
      '--order-by',
      'volume',
      '--limit',
      '5',
      '--filter',
      'has_social',
      '--filter',
      'not_wash_trading',
      '--raw',
    ],
    {
      env: process.env,
    }
  );

  const data = JSON.parse(stdout);

  console.log(
    JSON.stringify(
      {
        ok: true,
        count: Array.isArray(data) ? data.length : undefined,
        data,
      },
      null,
      2
    )
  );
} catch (error) {
  const message =
    error instanceof Error
      ? `${error.message}\n${error.stderr || error.stdout || ''}`.trim()
      : '调用 gmgn-cli 失败';

  console.error(message);
  process.exit(1);
}
