# Signal Worker

用于常驻执行 `signal scan` 的 Worker，适合先跑在本机，后续再迁移到云服务器。

## 命令

```bash
npm run signal:worker
npm run signal:once
npm run signal:cleanup
npm run signal:reset
```

## 行为

- `signal:worker`
  - 按 `SIGNAL_SCAN_INTERVAL` 持续扫描并推送信号
- `signal:once`
  - 只执行一轮信号扫描，适合本地调试或手动触发
- `signal:cleanup`
  - 手动清理 SQLite / PostgreSQL 中超出保留周期的旧数据，适合配合 `cron`、`launchd`、`pm2` 或云服务器定时任务
- `signal:reset`
  - 重置当前测试数据，适合切换新策略前清库重跑

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

如果后续需要切到 PostgreSQL，则把 `.env` 改成：

```env
SIGNAL_DB_DRIVER=postgres
SIGNAL_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
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
