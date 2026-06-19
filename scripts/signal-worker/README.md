# Signal Worker

用于常驻执行 `signal scan` 的 Worker，适合先跑在本机，后续再迁移到云服务器。

## 命令

```bash
npm run signal:worker
npm run signal:once
```

如需维护数据，可直接执行：

```bash
node scripts/maintenance/cleanup-signal-data.js
node scripts/maintenance/reset-signal-data.js
```

## 行为

- `signal:worker`
  - 按 `SIGNAL_SCAN_INTERVAL` 持续扫描并推送信号
- `signal:once`
  - 只执行一轮信号扫描，适合本地调试或手动触发

## 推荐命令

本地单机策略验证，先在 `.env` 里设置：

```env
SIGNAL_DB_DRIVER=sqlite
```

然后执行：

```bash
npm run dev
npm run signal:worker
```

如果后续需要切到 PostgreSQL，则按下面顺序处理：

1. 启动本地数据库：

```bash
docker compose -f docker-compose.postgres.yml up -d
```

2. 把 `.env` 改成：

```env
SIGNAL_DB_DRIVER=postgres
SIGNAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/automated_trading_meme
```

3. 初始化表结构：

```bash
npm run db:push
```

4. 再执行 worker 或单次扫描：

```bash
npm run signal:worker
# 或
npm run signal:once
```

## 建议环境变量

```env
SIGNAL_SCAN_INTERVAL=30
SIGNAL_SCAN_ROW_LIMIT=60
SIGNAL_DB_DRIVER=sqlite
```

兼容说明：

- 旧的 `RADAR_*` 环境变量仍然可用
- 新部署建议统一使用 `SIGNAL_*`
