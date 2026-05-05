# automated-trading-meme

一个面向 `SOL Meme` 的 `signal scan worker + 纸上交易 + Next.js 看板` 项目。

## 当前定位

当前项目优先服务两个目标：

- 用常驻 `signal worker` 做高频信号扫描
- 用 `paper trade` 验证策略可行性，而不是直接实盘

当前推荐部署结构：

```text
本机或云服务器
  -> signal worker 常驻扫描

Supabase
  -> 快照、信号历史、持仓、运行态

Vercel
  -> 看板页面、只读 API、策略参数配置
```

## 核心能力

- `SOL-only` 高频信号扫描
- 连续上涨动量识别
- `Supabase / SQLite` 双存储兼容
- 纸上账户开仓、止盈、止损和持仓跟踪
- Next.js 看板展示信号、持仓、收益和时间线
- Telegram 推送和异常观察

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`，至少填入：

```env
GMGN_API_KEY=your_gmgn_api_key
```

推荐最小配置：

```env
SIGNAL_SCAN_INTERVAL=30
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TG_CHAT_ID=your_telegram_chat_id
```

说明：

- `止盈 / 止损 / 时间止损 / trailing` 这类策略参数，优先在前端“策略参数”弹框里调整
- `.env.example` 只保留最小可运行配置
- 其他高级参数默认使用内置值，需要时再按需补充到 `.env`
- 数据源优先通过 `.env` 里的 `SIGNAL_STORAGE_DRIVER` 切换

兼容说明：旧的 `RADAR_*` 环境变量仍可继续使用，但新部署建议统一改成 `SIGNAL_*`。

### 3. 本地启动看板

```bash
npm run dev
```

打开 `http://localhost:3000`。

### 4. 启动信号扫描 Worker

持续运行：

```bash
npm run signal:worker
```

只跑一轮：

```bash
npm run signal:once
```

策略测试推荐先在 `.env` 中设置：

```env
SIGNAL_STORAGE_DRIVER=sqlite
```

然后启动：

```bash
npm run dev
npm run signal:worker
```

如果你需要用 Supabase 做跨进程共享，则把 `.env` 改成：

```env
SIGNAL_STORAGE_DRIVER=supabase
```

### 5. 测试 Telegram

```bash
npm run telegram:test
```

## 常用脚本

```bash
npm run dev            # 启动 Next.js 前端
npm run build          # 生产构建
npm start              # 启动生产服务
npm run signal:worker  # 常驻信号扫描 worker
npm run signal:once    # 只执行一轮信号扫描
npm run signal:cleanup # 手动清理 Supabase 历史数据
npm run signal:reset   # 按当前配置的数据源重置测试数据
npm run telegram:test  # 测试 Telegram 机器人
```

## 目录说明

- `app/`
  - Next.js 页面和只读 API
- `src/signal-scanner.js`
  - 信号扫描、交易评分、纸上交易、快照主逻辑
- `scripts/signal-worker/`
  - 本机或云服务器常驻 worker 入口
- `src/lib/signal-supabase-store.js`
  - Supabase 持久化与运行态同步
- `docs/`
  - 架构和策略说明
- `.signal-scan-data/`
  - 本地 SQLite 数据和日志目录

## 当前架构原则

- 页面只读，不触发主扫描
- worker 独立运行，后续可直接迁移到云服务器
- 策略验证优先，实盘执行后置
- 保持对旧 `radar_*` Supabase 表结构的兼容，避免立刻迁移线上数据
- 本地纯策略测试优先使用 `sqlite`
- 需要前后端分离或跨机器共享时再使用 `supabase`

## 注意事项

- 不要提交 `.env`
- 当前默认是纸上交易，不会真实下单
- 如果目标是 30 秒级策略，请让 worker 常驻运行
- 历史清理改为手动脚本或你自己的系统定时任务，不再内置 GitHub Actions workflow
- 如果要重新测试当前策略，先执行 `npm run signal:reset`
- `signal:reset` 会按当前 `.env` 的 `SIGNAL_STORAGE_DRIVER` 清理对应数据源；若未配置则默认同时清理 SQLite 和 Supabase

flowchart TD
A\[🚨 推送信号 Alert] --> B\[计算 tradeScore + 各项过滤]
