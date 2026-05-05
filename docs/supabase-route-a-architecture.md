# Supabase Signal Scan 架构

## 目标

当前路线 A 的目标是：

- 前端继续部署在 Vercel
- 信号扫描由独立 worker 触发
- 所有持久化数据写入 Supabase
- 默认按 15 天周期清理老数据
- 清理周期可通过 `.env` 调整

## 推荐结构

```text
Vercel
  -> 页面与只读 API

Signal Worker
  -> 执行 signal scan
  -> 可选配系统级 cleanup 定时任务

Supabase
  -> signal scan metadata
  -> signal history
  -> paper positions
  -> runtime state
```

## 四张表职责

说明：

- 当前代码仍兼容既有的 `radar_*` 表名
- 对外统一把这套存储视为 `signal scan` 存储层

### 元数据表

保存全局元数据：

- `strategy_started_at`
- `strategy_started_at_ts`
- `last_scanned_at`
- `last_scanned_at_ts`

这张表不参与 15 天清理，默认长期保留。

### 信号历史表

保存推送信号历史，供：

- 首页最新信号
- 信号统计页
- 交易决策映射

默认清理策略：

- 删除 15 天前的历史 alert

### 持仓表

保存纸上持仓和已平仓记录，供：

- 持仓信息页
- 收益统计

默认清理策略：

- `open` 持仓不删
- `closed` 且超过 15 天的记录删除

### 运行态表

保存 signal worker 重启后需要恢复的运行态：

- `momentum_tracker`
- `momentum_pushed`

默认清理策略：

- 删除 15 天前未更新的运行态

## 推荐运维方式

- 主扫描使用常驻 `signal worker`
- 清理任务不再依赖 GitHub Actions
- 如果需要自动清理，建议使用你自己的：
  - `cron`
  - `launchd`
  - `systemd timer`
  - 云服务器调度器

## 环境变量

放到 `.env`：

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_SCHEMA=public
SIGNAL_STORAGE_DRIVER=supabase
SIGNAL_DATA_RETENTION_DAYS=15
```

说明：

- `SIGNAL_DATA_RETENTION_DAYS`：统一保留天数，默认控制旧信号、旧的已平仓记录和过期运行态的清理

## 清理规则

默认建议如下：

- 元数据：长期保留
- 信号历史：保留 15 天
- 持仓：仅清理超过 15 天的已平仓记录
- 运行态：保留 15 天

对应 SQL 模板见：

- `sql/supabase_4_table_cleanup.sql`

## 推荐执行顺序

1. signal worker 启动扫描
2. 读取元数据和运行态
3. 拉取 GMGN 数据并计算信号
4. 写入信号历史
5. 更新持仓
6. 回写运行态
7. 更新元数据
8. 按需执行 `npm run signal:cleanup`

## 当前阶段建议

先按这套结构接入 Supabase，不要一开始就继续扩表。

优先完成：

- Supabase client
- 4 表 store
- 常驻 worker
- cleanup 脚本

等链路稳定后，再考虑：

- 更多统计表
- 更细的策略版本表
- 真正的订单流水表
