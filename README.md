# automated-trading-meme

一个面向 `SOL Meme` 的 `Signal Worker + 纸上交易 + Next.js 看板` 项目。

当前定位不是自动实盘，而是：

- 常驻扫描链上候选 Token
- 生成动量信号和交易评分
- 按固定规则做纸上模拟开平仓
- 在 Web 看板和 Telegram 中观察策略表现

## 项目现状

当前项目已经形成一套比较稳定的双进程结构：

```text
浏览器
  -> Next.js 页面 (/ /signals /vault)
  -> API Routes (/api/signals/snapshot /stream /config)

Worker 进程
  -> 持续扫描市场
  -> 更新信号、持仓、快照、Telegram 推送

存储
  -> SQLite 或 PostgreSQL
  -> PostgreSQL 可直接使用 Supabase 提供的连接串
```

推荐部署方式：

```text
Vercel / 本机 Web 服务
  -> Next.js 页面、只读 API、策略参数配置

本机 / 云服务器 / pm2
  -> signal worker 常驻运行

SQLite 或 PostgreSQL
  -> 信号历史、交易意图、纸上持仓、快照、运行态
```

## 核心能力

- `SOL-only` 高频信号扫描
- 连续走强动量识别
- 交易评分与交易风控过滤
- 纸上账户开仓、止盈、止损、时间退出、trailing 管理
- `SQLite / PostgreSQL` 双存储兼容
- Next.js 看板展示信号、持仓、收益、时间线与策略参数
- SSE + 轮询组合的实时数据刷新
- Telegram 推送与异常重试

## 页面入口

- `/`
  - 最新信号首页
  - 展示实时信号、交易条件、动量提示、市场指标
- `/signals`
  - 历史聚合信号页
  - 展示排序、搜索、评分与时间线
- `/vault`
  - 持仓信息页
  - 展示 open / closed 仓位、账户状态、当前策略摘要

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`，至少填入：

```env
GMGN_API_KEY=your_gmgn_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TG_CHAT_ID=your_telegram_chat_id
```

推荐最小配置：

```env
SIGNAL_SCAN_INTERVAL=30
SIGNAL_DB_DRIVER=sqlite
SIGNAL_DATA_DIR=.signal-scan-data
```

说明：

- `止盈 / 止损 / 时间止损 / trailing` 这类策略参数，优先在前端 `/vault` 页的“策略参数”弹框里调整
- `.env.example` 只保留最小可运行配置
- 高级交易参数默认使用内置值，需要时再按需补到 `.env`
- 数据源优先通过 `SIGNAL_DB_DRIVER` 切换
- 旧的 `RADAR_*` 环境变量仍兼容，但新部署建议统一使用 `SIGNAL_*`

### 3. 启动 Web 看板

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 4. 启动扫描 Worker

常驻运行：

```bash
npm run signal:worker
```

只执行一轮：

```bash
npm run signal:once
```

本地策略测试推荐先使用：

```env
SIGNAL_DB_DRIVER=sqlite
```

然后同时启动：

```bash
npm run dev
npm run signal:worker
```

如果需要切到本地 Docker PostgreSQL：

1. 启动数据库：

```bash
docker compose -f docker-compose.postgres.yml up -d
```

2. 把 `.env` 改成：

```env
SIGNAL_DB_DRIVER=postgres
SIGNAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/automated_trading_meme
```

3. 首次建表时执行：

```bash
npm run db:push
```

这里的 PostgreSQL 也可以换成：

- 自建 PostgreSQL
- Supabase 提供的 PostgreSQL 连接串

### 5. 测试 Telegram

如需单独测试 Telegram 机器人，可直接执行：

```bash
node scripts/telegram/test-bot.js
```

## 常用脚本

```bash
npm run dev            # 启动 Next.js 开发环境
npm run build          # 生产构建
npm start              # 启动生产 Web 服务
npm run db:push        # 按当前 schema 初始化 / 更新数据库表结构（非交互）
npm run signal:worker  # 常驻信号扫描 worker
npm run signal:once    # 只执行一轮扫描
```

## 核心目录

- `app/`
  - Next.js 页面与 API Routes
- `app/components/`
  - 看板通用 UI 组件
- `src/modules/signals/client/`
  - 前端 hooks 与 API client
- `src/modules/signals/query/`
  - 快照与配置查询层
- `src/modules/signals/server/`
  - 核心业务服务层
- `src/shared/db/`
  - Drizzle client / schema / repositories
- `src/signal-scanner.js`
  - 组合入口，对外暴露扫描与查询能力
- `scripts/signal-worker/`
  - worker 运行入口
- `docs/`
  - 架构文档与策略说明
- `.signal-scan-data/`
  - 本地 SQLite 数据与日志目录

## 当前运行原则

- 页面只读，不负责主扫描
- worker 独立运行，Web 端不会自动触发扫描循环
- 当前默认是纸上交易，不会真实下单
- 策略验证优先，实盘执行后置
- 本地纯策略测试优先使用 `sqlite`
- 需要共享存储时优先使用 `postgres`

## 当前策略摘要

当前策略是偏短线的 `SOL Meme` 动量策略，大致规则如下：

- 最近多轮扫描持续走强后才进入信号阶段
- 有信号不等于买入，还要通过交易评分和质量门槛
- 默认 `tradeScore >= 64` 才具备基础开仓资格
- 第 1 次信号最重要，第 2 次信号只有在明显更强时才允许补开头仓
- 当前实际是“一次性买满目标头仓”，买入后不再继续加仓
- 持仓阶段按 `分批止盈 + 固定止损 + 时间退出 + trailing` 管理

更详细说明见：

- [docs/README.md](./docs/README.md)
- [docs/策略简略说明.md](./docs/策略简略说明.md)

## 注意事项

- 不要提交 `.env`
- 若目标是 `30s` 级别策略，请确保 worker 常驻运行
- 如果要重新测试当前策略，可直接执行 `node scripts/maintenance/reset-signal-data.js`
- 策略参数在存在未平仓持仓时会被锁定，防止运行中修改风控规则

## 策略流程图

下面这张图用于快速说明当前项目从“发现信号”到“纸上平仓”的完整路径：

```mermaid
flowchart TD
    A[开始一轮扫描] --> B[拉取候选 SOL Meme 币]
    B --> C[基础过滤: 市值 流动性 噪音过滤]
    C --> D[记录最近几轮快照]
    D --> E{连续走强且累计涨幅达标?}

    E -- 否 --> E1[继续观察]
    E -- 是 --> F[生成动量信号]
    F --> G[计算 tradeScore]
    G --> H{交易门槛是否达标?}

    H -- 否 --> H1[记录信号但不买入]
    H -- 是 --> I{账户风控是否允许开仓?}

    I -- 否 --> I1[拒绝开仓: 持仓数 资金使用率 余额限制]
    I -- 是 --> J[一次性纸上买入目标头仓]

    J --> K[进入持仓监控]
    K --> L[每轮更新价格 浮盈亏 最高价]
    L --> M{触发某档止盈?}

    M -- 是 --> M1[按 TP 档位部分卖出]
    M -- 否 --> N[继续检查]
    M1 --> N

    N --> O{触发固定止损?}
    O -- 是 --> O1[全部平仓]
    O -- 否 --> P{超过 time stop 且未到 TP1?}

    P -- 是 --> P1[时间退出]
    P -- 否 --> Q{已启动 trailing 且回撤达标?}
    Q -- 是 --> Q1[尾仓平掉]
    Q -- 否 --> R[继续持仓 等下一轮]
```

## GitHub Star History

[![Star History Chart](https://api.star-history.com/svg?repos=0xSnickers/automated-trading-meme&type=Date)](https://star-history.com/#0xSnickers/automated-trading-meme&Date)
