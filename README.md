# gmgn-api

这是一个基于 Node.js 的 GMGN 对接示例项目。

当前项目除了基础的 GMGN 查询能力，也已经包含:

- SOL Meme 雷达扫描
- SQLite 推送持久化
- Next.js 推送看板

如果你要继续往“根据 GMGN 信号自动交易”方向扩展，先看:

- `docs/auto-trading-architecture.md`

当前实现不是直接用 `fetch` 或 `axios` 去请求 GMGN 网页接口，而是采用更稳定、也更贴近官方文档的方式:

- Node.js 作为服务层
- `gmgn-cli` 作为底层 GMGN 能力调用器
- `Express` 对外暴露 HTTP 接口

这样做的目的，是先把最小可用链路跑通:

- Node 服务正常启动
- 正确读取 `.env` 中的 `GMGN_API_KEY`
- 通过 `gmgn-cli` 请求 GMGN 热门榜数据
- 通过 HTTP 接口把结果返回给调用方

## 当前实现内容

当前项目已经实现了以下能力:

- `GET /health`
  - 用于检查 Node 服务是否已启动
- `GET /api/market/meme/trending`
  - 查询热门 MEME Token 榜单
  - 当前默认面向 `sol` 链
  - 支持链、时间窗口、返回数量参数

当前项目中几个关键文件如下:

- `package.json`
  - 定义项目脚本与依赖
- `src/server.js`
  - Express 服务入口
  - 负责参数校验、调用 `gmgn-cli`、返回 HTTP 响应
- `src/test-meme-query.js`
  - 独立测试脚本
  - 不启动 HTTP 服务也可以直接验证 GMGN 调用链路
- `.env`
  - 项目级环境变量
  - 当前用于放置 `GMGN_API_KEY`

## 当前实现逻辑

### 1. 服务启动

执行下面命令后:

```bash
npm start
```

Node 会启动 `src/server.js`，默认监听:

```text
http://localhost:3000
```

服务启动成功后，终端会输出:

```bash
GMGN API server listening on http://localhost:3000
```

### 2. 读取环境变量

`src/server.js` 顶部使用了:

```js
import 'dotenv/config';
```

这表示 Node 在启动时会自动读取项目根目录下的 `.env` 文件。

当前会读取:

```env
GMGN_API_KEY=your_api_key
```

如果没有读到这个变量，代码会在真正请求 GMGN 之前报错:

```js
function requireApiKey() {
  if (!process.env.GMGN_API_KEY) {
    throw new Error('缺少 GMGN_API_KEY，请先在项目 .env 或全局配置中设置。');
  }
}
```

### 3. 封装 GMGN 调用

项目没有直接请求某个网页地址，而是统一通过 `runGmgn()` 调用 `gmgn-cli`:

```js
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
```

这段逻辑做了 4 件事:

- 检查 `GMGN_API_KEY` 是否存在
- 通过 `execa` 执行本机安装好的 `gmgn-cli`
- 自动追加 `--raw`，让 `gmgn-cli` 直接输出 JSON
- 把 `stdout` 解析成 JavaScript 对象返回给接口层

### 4. 热门 MEME Token 查询接口

当前热门榜接口定义如下:

```js
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
```

它的执行过程是:

1. 接收 HTTP 请求参数
2. 使用 `zod` 校验 `chain`、`interval`、`limit`
3. 拼接 `gmgn-cli market trending` 命令
4. 调用 GMGN 返回热门榜 JSON
5. 把 JSON 再包装成统一 HTTP 响应返回前端

## 热门榜接口参数说明

### 请求地址

```text
GET /api/market/meme/trending
```

### 支持参数

- `chain`
  - 可选值: `sol`、`bsc`、`base`、`eth`
  - 默认值: `sol`
- `interval`
  - 可选值: `1m`、`5m`、`1h`、`6h`、`24h`
  - 默认值: `1h`
- `limit`
  - 取值范围: `1-50`
  - 默认值: `10`

### 示例请求

```bash
curl -s 'http://localhost:3000/api/market/meme/trending?chain=sol&interval=1h&limit=3'
```

### 示例响应

```json
{
  "ok": true,
  "query": {
    "chain": "sol",
    "interval": "1h",
    "limit": 3
  },
  "data": {
    "code": 0,
    "data": {
      "rank": []
    },
    "message": "success",
    "reason": ""
  }
}
```

## GMGN 对接实现过程

下面是本项目实际采用的 GMGN 对接过程。

### 第 1 步: 安装 Node 依赖

项目依赖如下:

- `express`
  - 提供 HTTP 服务
- `dotenv`
  - 读取 `.env`
- `execa`
  - 在 Node 中调用 `gmgn-cli`
- `zod`
  - 校验接口入参

如果需要重新安装依赖，执行:

```bash
npm install
```

### 第 2 步: 安装并验证 gmgn-cli

先确认本机已经安装 `gmgn-cli`:

```bash
gmgn-cli --version
```

如果没有安装，可以执行:

```bash
npm install -g gmgn-cli
```

本项目当前验证通过的方式，是先直接运行底层命令，看是否能拿到 JSON:

```bash
gmgn-cli market trending --chain sol --interval 1h --limit 3 --raw
```

如果这条命令能返回 JSON，就说明:

- 本机 `gmgn-cli` 可用
- 当前环境变量已生效
- 调用 GMGN 的链路是通的

### 第 3 步: 配置 API Key

项目把 GMGN Key 放在根目录 `.env` 中。

格式如下:

```env
GMGN_API_KEY=your_api_key
```

注意事项:

- 不要把真实 Key 提交到 Git 仓库
- 不要打印到日志
- 不要透传给前端

如果后面要做交易相关接口，例如 `swap`、`order`、`strategy`，还需要额外配置:

```env
GMGN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

但当前项目只做只读查询，所以目前只依赖 `GMGN_API_KEY`。

### 第 4 步: 在 Node 中调用 gmgn-cli

对接 GMGN 的关键，不是自己去猜官方网页请求，而是直接在 Node 里执行:

```bash
gmgn-cli market trending ...
```

Node 中具体通过 `execa()` 执行:

```js
const { stdout } = await execa('gmgn-cli', finalArgs, {
  env: process.env,
});
```

这里把 `process.env` 显式传给子进程，是为了确保:

- `.env` 中的 `GMGN_API_KEY` 能被 `gmgn-cli` 读取
- Node 进程和 `gmgn-cli` 子进程使用同一套环境变量

### 第 5 步: 把 CLI 结果封装成 HTTP 接口

本项目当前已经把热门榜命令封成了一个 HTTP 接口。

底层命令等价于:

```bash
gmgn-cli market trending \
  --chain sol \
  --interval 1h \
  --order-by volume \
  --limit 3 \
  --filter has_social \
  --filter not_wash_trading \
  --raw
```

然后通过 `Express` 返回结果:

```json
{
  "ok": true,
  "query": {
    "chain": "sol",
    "interval": "1h",
    "limit": 3
  },
  "data": {
    "...": "..."
  }
}
```

### 第 6 步: 独立脚本验证

为了快速定位问题，项目里额外提供了:

- `src/test-meme-query.js`

它的作用是跳过 HTTP 服务，直接测试:

- `.env` 是否读取成功
- `gmgn-cli` 是否调用成功
- 返回值是否能被 JSON 解析

运行方式:

```bash
npm run test:meme
```

如果这个脚本成功，而 HTTP 接口失败，就说明问题多半不在 GMGN，而是在:

- 路由没写
- 参数没传对
- 服务没启动
- URL 写错

## 为什么采用 gmgn-cli 封装，而不是直接请求网页接口

当前项目采用 `gmgn-cli` 主要有以下原因:

- 文档路径更清晰
  - 参数和命令都能直接参考 GMGN 文档
- 接入更稳定
  - 避免自己分析网页请求
- 便于调试
  - 先在命令行跑通，再封装到接口
- 更适合渐进式开发
  - 可以先做只读查询，再扩展到交易

## 当前实现中的一次实际排错

最开始热门榜接口尝试使用了:

```text
not_risk
not_honeypot
```

但在当前安装的 `gmgn-cli` 版本中，这两个过滤参数不被支持，实际返回:

```text
invalid filter: get not_risk ...
```

因此当前项目改成了兼容当前 CLI 版本的过滤参数:

- `has_social`
- `not_wash_trading`

这也是当前对接流程中的一个重要经验:

- 文档中的参数不一定和本机已安装 CLI 版本完全一致
- 真实对接时要以当前命令执行结果为准

## 如何运行项目

### 启动服务

```bash
cd /Users/chuizi/josen/onchain-coding/gmgn-api
npm start
```

### 测试健康检查

```bash
curl -s 'http://localhost:3000/health'
```

### 测试热门榜接口

```bash
curl -s 'http://localhost:3000/api/market/meme/trending?chain=sol&interval=1h&limit=3'
```

### 运行底层测试脚本

```bash
npm run test:meme
```

## 如何调试接口

后续新增接口时，建议按下面顺序调试。

### 1. 先确认服务是否启动

看是否能访问:

```bash
curl -s 'http://localhost:3000/health'
```

如果这里不通，先不要查 GMGN，先查:

- `npm start` 是否执行
- 端口是否被占用
- 服务是否异常退出

### 2. 再确认路由是否存在

如果返回:

```text
Cannot GET /api/token/info
```

表示请求已经到达 Express，但这个路由还没实现。

这类错误不是 GMGN 报的，而是服务端没有注册对应接口。

### 3. 再单独跑 gmgn-cli 命令

比如你后面要做 `token info`，先直接在终端验证:

```bash
gmgn-cli token info --chain sol --address <token_address> --raw
```

如果命令能通，再去写 HTTP 接口。

### 4. 分析错误类型

常见情况如下:

- `Cannot GET ...`
  - 路由不存在
- `500`
  - 路由存在，但内部调用失败
- `400`
  - 参数错误
- `401 / 403`
  - API Key、权限、出口网络或 IPv6 问题

### 5. 必要时打印调试日志

后续如果你要增强调试能力，可以在接口里打印:

- `req.query`
- 实际调用的 `gmgn-cli` 参数
- `stdout`
- `stderr`

这样能快速看出问题到底出在:

- HTTP 参数
- Node 服务
- `gmgn-cli`
- GMGN 接口返回

## 后续建议扩展

当前项目只实现了热门 MEME Token 查询，后续建议按下面顺序继续扩展:

### 第一批只读接口

- `/api/token/info`
- `/api/token/security`
- `/api/market/trenches`
- `/api/portfolio/holdings`
- `/api/track/smartmoney`

### 第二批交易接口

这部分需要 `GMGN_PRIVATE_KEY`:

- `/api/swap`
- `/api/order/quote`
- `/api/order/strategy/create`
- `/api/order/strategy/list`

## 当前项目的核心结论

这个项目当前已经完成了最小可用的 GMGN 接入验证，调用链路如下:

```text
HTTP 请求
-> Express 路由
-> zod 参数校验
-> execa 调用 gmgn-cli
-> gmgn-cli 使用 GMGN_API_KEY 请求 GMGN
-> 返回 JSON
-> Express 输出 HTTP 响应
```

也就是说，当前项目已经证明:

- `.env` 中的 `GMGN_API_KEY` 可以被 Node 正常读取
- Node 可以把环境变量传递给 `gmgn-cli`
- `gmgn-cli` 可以成功调用 GMGN 热门榜能力
- 最终可以通过 HTTP 接口把结果返回出来

如果你后面继续扩展功能，建议保持同样的模式:

- 先命令行验证
- 再 Node 封装
- 最后暴露 HTTP 接口
