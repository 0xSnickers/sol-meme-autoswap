# sol-meme-autoswap

一个面向 `SOL Meme` 的 GMGN 雷达与纸上交易看板。

它做三件事：

- 扫描符合条件的 `SOL Meme`
- 用风控规则做纸上开平仓
- 在前端实时看账户、持仓、已平仓和推送信号

## 核心能力

- `SOL-only` 扫描，聚焦 Meme 场景
- 动量雷达，识别连续放量上涨信号
- SQLite 持久化，刷新页面不丢历史
- Next.js 看板，直接看账户权益和仓位变化
- 纸上交易，支持 `TP / SL / 资金约束 / 持仓上限`
- 实时推送，前端可以持续看到最新价格和账户状态

## 当前策略

- 只扫描 `SOL`
- 动量触发：`3` 轮连续上涨，且总涨幅 `>= 5%`
- 推送过滤：聪明钱、流动性、持有人、成交量、买卖比
- 纸上交易：`tradeScore >= 80`
- 只做第 `1` 次信号
- 最多 `4` 个打开持仓
- 账户总资金 `1000 USD`
- 资金使用率上限 `50%`
- 默认 `TP +20% / SL -25%`

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`，至少填入：

```env
GMGN_API_KEY=your_api_key
```

可选：

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TG_CHAT_ID=your_chat_id
RADAR_PAPER_TOTAL_CAPITAL_USD=1000
```

### 3. 本地启动看板

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

### 4. 启动雷达

```bash
npm run radar:start
```

只跑一轮：

```bash
npm run radar:once
```

## 常用脚本

```bash
npm run dev          # 启动 Next.js 前端
npm run build        # 生产构建
npm start            # 启动生产服务
npm run radar:start  # 启动雷达与纸上交易
npm run radar:once   # 只扫描一轮
npm run test:meme    # 测试 GMGN 热门榜查询
npm run telegram:test
```

## 页面里能看到什么

- 账户权益
- 可用余额
- 打开持仓数
- 资金使用率
- 浮动盈亏
- 已实现盈亏
- 推送数
- 持仓中 / 已平仓卡片
- 每个 Token 的最新信号与交易状态

## 目录说明

- `app/`
  - Next.js 页面和 API 路由
- `src/trading-radar.js`
  - 雷达扫描、评分、纸上交易、持久化主逻辑
- `src/server.js`
  - 早期 Express 接口，作为 legacy 保留
- `docs/策略复盘/`
  - 每次策略调整的复盘记录
- `.radar-data/`
  - SQLite 数据和运行日志，本地使用，不提交

## 使用建议

- 先运行 `npm run radar:once`，确认 API Key 和扫描链路正常
- 再运行 `npm run radar:start`，持续观察信号和账户变化
- 看板重点关注：
  - `账户权益`
  - `资金使用率`
  - `打开持仓`
  - `已实现盈亏`

## 注意事项

- 不要提交 `.env`
- 不要提交密钥文件
- `.radar-data/` 只做本地测试数据
- 当前是纸上交易，不会真实下单

## 策略文档

- `docs/策略复盘/2026-05-01_10-40-策略复盘.md`
- `docs/策略复盘/2026-05-01_10-55-v1策略落地.md`
- `docs/策略复盘/2026-05-01_13-30-1000美元账户与双列持仓面板.md`
- `docs/策略复盘/2026-05-01_13-45-v1.1风控收紧版.md`
- `docs/策略复盘/2026-05-02_02-20-清库重启与收益面板收敛.md`

## Star 趋势

[![Star History Chart](https://api.star-history.com/svg?repos=0xSnickers/sol-meme-autoswap&type=Date)](https://star-history.com/#0xSnickers/sol-meme-autoswap&Date)
