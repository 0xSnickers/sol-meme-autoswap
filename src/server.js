import 'dotenv/config';
import express from 'express';
import { execa } from 'execa';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT || 3000);

const querySchema = z.object({
  chain: z.enum(['sol', 'bsc', 'base', 'eth']).default('sol'),
  interval: z.enum(['1m', '5m', '1h', '6h', '24h']).default('1h'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

function requireApiKey() {
  if (!process.env.GMGN_API_KEY) {
    throw new Error('缺少 GMGN_API_KEY，请先在项目 .env 或全局配置中设置。');
  }
}

async function runGmgn(args) {
  requireApiKey();

  const finalArgs = [...args, '--raw'];
  const { stdout } = await execa('gmgn-cli', finalArgs, {
    env: process.env,
  });

  try {
    return JSON.parse(stdout);
  } catch {
    return { raw: stdout };
  }
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gmgn-api',
  });
});

app.get('/api/market/meme/trending', async (req, res) => {
  try {
    const { chain, interval, limit } = querySchema.parse(req.query);

    const data = await runGmgn([
      'market',
      'trending',
      '--chain',
      chain,
      '--interval',
      interval,
      '--order-by',
      'volume',
      '--limit',
      String(limit),
      '--filter',
      'has_social',
      '--filter',
      'not_wash_trading',
    ]);

    res.json({
      ok: true,
      query: { chain, interval, limit },
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '请求热门 MEME Token 失败';

    res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.listen(port, () => {
  console.log(`GMGN API server listening on http://localhost:${port}`);
});
