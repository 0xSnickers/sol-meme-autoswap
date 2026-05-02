# 自动交易架构设计

## 目标

当前项目的第一阶段目标是稳定产出可解释的信号。
第二阶段目标是在 GMGN 上根据这些信号自动执行交易。

为了避免后续从“看板项目”重构成“交易系统”时推倒重来，当前架构建议从一开始就拆成 6 层。

## 核心原则

- 信号生成和交易执行必须解耦
- 页面展示只读，不直接触发交易
- 交易动作必须经过风控层
- 所有信号、决策、下单、成交都要可追溯
- 任何自动交易都必须支持手动关闭

## 推荐分层

### 1. 数据采集层

职责:

- 从 GMGN 拉取候选 Token 数据
- 从 RugCheck / GoPlus 拉取安全数据
- 从 GMGN Token 描述中提取 X、TG、官网

当前对应:

- `src/trading-radar.js`

后续建议拆分:

- `src/modules/market-data/gmgn-source.js`
- `src/modules/security/rugcheck-source.js`
- `src/modules/security/goplus-source.js`
- `src/modules/social/social-parser.js`

### 2. 信号引擎层

职责:

- 计算连续上涨轮次
- 判断是否满足聪明钱、流动性、持有人、买卖比等门槛
- 输出标准化信号对象

建议输出结构:

```js
{
  signalId: 'sol:token:3',
  chain: 'sol',
  address: 'xxx',
  symbol: 'ABC',
  strategy: 'sol_meme_momentum_v1',
  status: 'triggered',
  score: 82,
  occurrenceCount: 3,
  triggeredAt: '2026-05-01T10:30:00.000Z',
  metrics: {
    marketCap: 120000,
    liquidity: 9000,
    smartMoney: 4,
    holders: 230,
    volume1h: 45000,
    buySellRatio: 1.42,
    pctGain: 8.7,
  },
}
```

后续建议拆分:

- `src/modules/signals/momentum-engine.js`
- `src/modules/signals/quality-gate.js`
- `src/modules/signals/signal-normalizer.js`

### 3. 持久化层

职责:

- 存历史信号
- 存每次信号发生的时间点
- 存策略版本
- 存交易记录和持仓状态

当前已经有:

- `pushed_alerts`
- `radar_meta`

后续建议新增表:

- `trade_intents`
  - 风控通过后，等待执行的交易意图
- `trade_orders`
  - 已提交到 GMGN 的订单
- `trade_fills`
  - 订单成交记录
- `positions`
  - 当前持仓
- `strategy_configs`
  - 每个策略的参数快照

### 4. 决策与风控层

职责:

- 判断某个信号是否允许自动交易
- 限制单笔仓位
- 限制同类信号重复开仓
- 限制同一时间最大持仓数
- 限制单日总亏损

建议在自动交易前必须增加:

- 最小流动性校验
- 最大滑点校验
- 黑名单 Token / Dev / 钱包校验
- 连续信号去重
- 冷却时间
- 最大仓位比例

后续建议拆分:

- `src/modules/risk/risk-engine.js`
- `src/modules/risk/position-limiter.js`
- `src/modules/risk/drawdown-guard.js`
- `src/modules/risk/cooldown-guard.js`

### 5. 执行层

职责:

- 把已批准的交易意图转换成 GMGN 下单命令
- 获取报价
- 执行市价单或条件单
- 记录订单与成交结果

推荐做法:

- 不让页面直接调 GMGN 交易
- 统一由服务端 Worker 执行
- 执行前先写入 `trade_intents`
- 执行成功后写入 `trade_orders` / `trade_fills`

后续建议拆分:

- `src/modules/execution/gmgn-gateway.js`
- `src/modules/execution/order-service.js`
- `src/modules/execution/fill-reconciler.js`

### 6. 展示与操作层

职责:

- 展示信号列表
- 展示多次信号历史
- 展示是否已交易
- 展示持仓、盈亏、止盈止损状态
- 提供手动启停自动交易的控制台

建议后续页面增加:

- 信号详情抽屉
- 自动交易总开关
- 策略级开关
- 仓位与风险面板
- 订单与成交流水

## 当前阶段的建议目录

```text
app/
  api/
    radar/
      scan/
src/
  trading-radar.js
  modules/
    signals/
    persistence/
    risk/
    execution/
    portfolio/
docs/
  auto-trading-architecture.md
```

## 推荐的执行链路

当前:

```text
扫描 -> 生成信号 -> 存入 SQLite -> 页面展示 / Telegram 推送
```

后续自动交易:

```text
扫描
-> 生成信号
-> 风控评估
-> 生成交易意图
-> 获取 GMGN quote
-> 下单
-> 记录订单与成交
-> 更新持仓
-> 页面展示交易状态
```

## 为什么现在就要这样设计

如果后面直接在信号代码里调用 GMGN 交易命令，会出现几个问题:

- 信号与交易强耦合，难以排错
- 页面刷新可能重复触发下单
- 风控无法独立演进
- 很难做回放、审计、复盘

所以现在最重要的预留不是“立刻下单”，而是先把下面这 3 个对象固定下来:

- `Signal`
- `TradeIntent`
- `Order / Fill`

## 建议的下一阶段

### 第一阶段

- 完善 SQLite 信号聚合
- 页面展示同一 Token 的多次信号历史
- 补策略版本字段

### 第二阶段

- 新增 `trade_intents` 表
- 实现 `paper trade` 模式
- 不真下单，只记录“如果交易会怎么做”

### 第三阶段

- 接入 GMGN quote
- 接入真实下单
- 接入止盈止损策略单

### 第四阶段

- 增加持仓面板
- 增加自动交易开关
- 增加风控控制台

## 当前结论

当前项目已经具备“信号系统”的基础:

- 多轮扫描
- 规则过滤
- SQLite 持久化
- 页面展示

下一步不是直接把“交易命令”塞进现有扫描函数，而是把项目升级为:

- 信号系统
- 风控系统
- 执行系统
- 持仓系统

四者解耦的自动交易架构。
