import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

dotenv.config({
  path: path.join(os.homedir(), '.env'),
  override: false,
  quiet: true,
});
dotenv.config({ override: false, quiet: true });

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.radar-data');
let DATA_DIR = process.env.RADAR_DATA_DIR || DEFAULT_DATA_DIR;
const SCAN_INTERVAL = Number(process.env.RADAR_SCAN_INTERVAL || 30);
const MAX_MARKET_CAP = Number(process.env.RADAR_MAX_MC || 10_000_000);
const MIN_MARKET_CAP = Number(process.env.RADAR_MIN_MC || 1_000);
const MIN_LIQUIDITY = Number(process.env.RADAR_MIN_LIQUIDITY || 500);
const PUSH_MIN_LIQUIDITY = Number(process.env.RADAR_PUSH_MIN_LIQUIDITY || 3_000);
const PUSH_MIN_HOLDERS = Number(process.env.RADAR_PUSH_MIN_HOLDERS || 50);
const PUSH_MIN_VOLUME = Number(process.env.RADAR_PUSH_MIN_VOLUME || 10_000);
const PUSH_MIN_BUY_SELL_RATIO = Number(
  process.env.RADAR_PUSH_MIN_BUY_SELL_RATIO || 1.1
);
const REQUIRE_SOCIALS =
  String(process.env.RADAR_REQUIRE_SOCIALS || 'true').toLowerCase() !== 'false';
const MIN_SMART_DEGEN_COUNT = Number(process.env.RADAR_MIN_SMART_DEGEN || 2);
const MOMENTUM_CONSECUTIVE_UP = 3;
const MAX_ALERTS_PER_ROUND = 8;
const TRADE_SCORE_THRESHOLD = Number(process.env.RADAR_TRADE_SCORE_THRESHOLD || 80);
const TRADE_MIN_SMART_MONEY = Number(process.env.RADAR_TRADE_MIN_SMART_MONEY || 3);
const TRADE_MAX_SIGNAL_COUNT = Number(process.env.RADAR_TRADE_MAX_SIGNAL_COUNT || 1);
const TRADE_MIN_LIQUIDITY = Number(process.env.RADAR_TRADE_MIN_LIQUIDITY || 5_000);
const TRADE_MIN_VOLUME = Number(process.env.RADAR_TRADE_MIN_VOLUME || 20_000);
const TRADE_MIN_BUY_SELL_RATIO = Number(process.env.RADAR_TRADE_MIN_BUY_SELL_RATIO || 1.2);
const PAPER_TAKE_PROFIT_PERCENT = Number(process.env.RADAR_PAPER_TP_PERCENT || 20);
const PAPER_STOP_LOSS_PERCENT = Number(process.env.RADAR_PAPER_SL_PERCENT || 25);
const PAPER_BASE_POSITION_USD = Number(process.env.RADAR_PAPER_BASE_POSITION_USD || 60);
const PAPER_TOTAL_CAPITAL_USD = Number(process.env.RADAR_PAPER_TOTAL_CAPITAL_USD || 1_000);
const PAPER_MAX_OPEN_POSITIONS = Number(process.env.RADAR_PAPER_MAX_OPEN_POSITIONS || 4);
const PAPER_MAX_CAPITAL_USAGE_PCT = Number(
  process.env.RADAR_PAPER_MAX_CAPITAL_USAGE_PCT || 50
);

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT_ID =
  process.env.TG_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';

const GMGN_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
  Referer: 'https://gmgn.ai/',
};

const MOMENTUM_TRACKER = new Map();
const MOMENTUM_PUSHED = new Map();

const MUSK_TRUMP_KEYWORDS = new Set([
  'musk',
  'elon',
  'elonmusk',
  'spacex',
  'starship',
  'tesla',
  'cybertruck',
  'roadster',
  'neuralink',
  'boring',
  'hyperloop',
  'xai',
  'grok',
  'floki',
  'shiba',
  'doge father',
  'dogefather',
  'technoking',
  'mars colony',
  'mars',
  'trump',
  'donald',
  'maga',
  'potus',
  'trump47',
  'melania',
  'barron',
  'ivanka',
  'dark maga',
  'darkmaga',
  'ultra maga',
  'save america',
  'truth social',
  'covfefe',
  'doge department',
  'd.o.g.e',
  'government efficiency',
]);

const MUSK_TRUMP_PATTERNS = [
  /\belon\b/i,
  /\bmusk\b/i,
  /\btrump\b/i,
  /\bmaga\b/i,
  /\bspacex\b/i,
  /\bstarship\b/i,
  /\btesla\b/i,
  /\bgrok\b/i,
  /\bmelania\b/i,
  /\bbarron\b/i,
  /\bdoge\s*department\b/i,
  /\bd\.?o\.?g\.?e\b/i,
  /\bx\s*ai\b/i,
  /\bneuralink\b/i,
];

const BINANCE_CZ_KEYWORDS = new Set([
  'cz',
  'changpeng',
  'zhao',
  'czb',
  'czbinance',
  'heyi',
  'yi he',
  'he yi',
  '何一',
  'yihe',
  'sister yi',
  'yi jie',
  '一姐',
  '何一姐',
  'binance',
  'bnb',
  'pancake',
  'pancakeswap',
  'giggle academy',
  'binance life',
  'bnb chain',
  'principles',
  'cz book',
  'yzi',
  'yzi labs',
  '赵长鹏',
  '币安',
  '长鹏',
  'cz的',
  '何一的',
  'fourmeme',
  'four meme',
  '4meme',
  'czs dog',
  'cz dog',
  'bnb dog',
  'build on bnb',
  'bnb ecosystem',
]);

const BINANCE_CZ_PATTERNS = [
  /\bcz\b/i,
  /\bbinance\b/i,
  /\bbnb\b/i,
  /\bheyi\b/i,
  /\byi\s*he\b/i,
  /\bhe\s*yi\b/i,
  /\b何一\b/i,
  /\b一姐\b/i,
  /\bpancake\b/i,
  /\bgiggle\b/i,
  /\byzi\b/i,
  /\bfourmeme\b/i,
  /\b4meme\b/i,
];

const CELEBRITY_VIRAL_KEYWORDS = new Set([
  'vitalik',
  'buterin',
  'sam altman',
  'satoshi',
  'michael saylor',
  'saylor',
  'cathie wood',
  'jack dorsey',
  'zuckerberg',
  'bezos',
  'jensen huang',
  'nvidia',
  'tim cook',
  'justin sun',
  'sun yuchen',
  '孙宇晨',
  'tron',
  'arthur hayes',
  'su zhu',
  '3ac',
  'brian armstrong',
  'coinbase',
  'larry fink',
  'blackrock',
  'gary gensler',
  'sec',
  'michael novogratz',
  'galaxy',
  'biden',
  'obama',
  'putin',
  'xi jinping',
  'kanye',
  'drake',
  'snoop dogg',
  'paris hilton',
  'mark cuban',
  'mr beast',
  'mrbeast',
  'lobster',
  '龙虾',
  'lobsta',
  'hawk tuah',
  'griddy',
  'skibidi',
  'rizz',
  'sigma',
  'gyatt',
  'etf',
  'halving',
  '减半',
  'world war',
  'wwiii',
  'fed',
  'rate cut',
  '降息',
  'tiktok ban',
  'tiktok',
]);

const CELEBRITY_VIRAL_PATTERNS = [
  /\bvitalik\b/i,
  /\bsaylor\b/i,
  /\bblackrock\b/i,
  /\bcoinbase\b/i,
  /\bjustin\s*sun\b/i,
  /\blobster\b/i,
  /\betf\b/i,
  /\bhalving\b/i,
  /\bmrbeast\b/i,
  /\bsnoop\b/i,
  /\bkanye\b/i,
  /\bdrake\b/i,
];

const SPAM_PATTERNS = [
  /airdrop/i,
  /presale/i,
  /pre\s*sale/i,
  /1000x/i,
  /100x guaranteed/i,
  /safe\s*moon/i,
  /baby\s*\w+/i,
  /pornhub/i,
  /porn/i,
  /xxx/i,
  /nsfw/i,
  /scam/i,
  /rugpull/i,
  /rug\s*pull/i,
  /official\s*token/i,
  /official\s*coin/i,
];

const COMMON_NOISE_WORDS = new Set([
  'nice',
  'good',
  'bad',
  'cool',
  'hot',
  'big',
  'small',
  'life',
  'love',
  'hate',
  'happy',
  'sad',
  'fun',
  'lol',
  'cat',
  'dog',
  'moon',
  'sun',
  'star',
  'king',
  'queen',
  'gold',
  'rich',
  'cash',
  'money',
  'pay',
  'buy',
  'sell',
  'pump',
  'dump',
  'bull',
  'bear',
  'green',
  'red',
  'hello',
  'world',
  'yes',
  'no',
  'wow',
  'omg',
  'lmao',
  'simp',
  'chad',
  'based',
  'cope',
  'seethe',
  'test',
  'new',
  'old',
  'real',
  'fake',
  'shit',
  'shitcoin',
  'fuck',
  'fart',
  'poop',
  'pee',
  'cum',
  'dick',
  'ass',
  'boob',
  'tit',
  'retard',
  'slop',
  'the',
  'and',
  'for',
  'from',
  'with',
  'this',
  'that',
  'coin',
  'token',
  'meme',
  'pepe',
  'wojak',
  'peg',
  'usd',
  'usdt',
  'usdc',
  'dai',
]);

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (error) {
    if (DATA_DIR !== DEFAULT_DATA_DIR) {
      DATA_DIR = DEFAULT_DATA_DIR;
      fs.mkdirSync(DATA_DIR, { recursive: true });
      return;
    }
    throw error;
  }
}

function log(message) {
  ensureDataDir();
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${message}`;
  console.log(line);
  fs.appendFileSync(path.join(DATA_DIR, 'narrative_radar.log'), `${line}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

function initDb() {
  ensureDataDir();
  const db = new Database(path.join(DATA_DIR, 'narrative_history.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS narratives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      theme TEXT NOT NULL,
      first_token_name TEXT,
      first_token_address TEXT,
      first_chain TEXT,
      first_seen_at INTEGER,
      token_count INTEGER DEFAULT 1,
      last_seen_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS tokens_seen (
      address TEXT PRIMARY KEY,
      chain TEXT,
      name TEXT,
      symbol TEXT,
      narrative_theme TEXT,
      category TEXT,
      first_seen_at INTEGER,
      market_cap REAL,
      pushed INTEGER DEFAULT 0,
      seen_count INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pushed_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain TEXT NOT NULL,
      address TEXT NOT NULL,
      signal_count INTEGER NOT NULL DEFAULT 1,
      name TEXT,
      symbol TEXT,
      price REAL,
      mc REAL,
      liq REAL,
      volume REAL,
      smart_money INTEGER,
      holders INTEGER,
      buy_sell_ratio REAL,
      age_hours REAL,
      change_1h REAL,
      pct_gain REAL,
      stars INTEGER,
      narrative_tag TEXT,
      category TEXT,
      twitter TEXT,
      telegram TEXT,
      website TEXT,
      message TEXT,
      pushed_at INTEGER NOT NULL,
      UNIQUE(chain, address, signal_count)
    );

    CREATE TABLE IF NOT EXISTS radar_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS trade_intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain TEXT NOT NULL,
      address TEXT NOT NULL,
      signal_count INTEGER NOT NULL,
      name TEXT,
      symbol TEXT,
      trade_score INTEGER,
      status TEXT NOT NULL,
      decision_reason TEXT,
      smart_money INTEGER,
      buy_sell_ratio REAL,
      liquidity REAL,
      volume REAL,
      price REAL,
      created_at INTEGER NOT NULL,
      UNIQUE(chain, address, signal_count)
    );

    CREATE TABLE IF NOT EXISTS paper_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain TEXT NOT NULL,
      address TEXT NOT NULL,
      name TEXT,
      symbol TEXT,
      entry_signal_count INTEGER NOT NULL,
      trade_score INTEGER,
      position_size_usd REAL,
      token_amount REAL,
      entry_price REAL NOT NULL,
      current_price REAL,
      take_profit_pct REAL NOT NULL,
      stop_loss_pct REAL NOT NULL,
      status TEXT NOT NULL,
      opened_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      closed_at INTEGER,
      close_price REAL,
      close_reason TEXT,
      pnl_pct REAL DEFAULT 0,
      smart_money INTEGER,
      buy_sell_ratio REAL,
      liquidity REAL,
      volume REAL,
      UNIQUE(chain, address, entry_signal_count)
    );

    CREATE INDEX IF NOT EXISTS idx_theme ON narratives(theme);
    CREATE INDEX IF NOT EXISTS idx_addr ON tokens_seen(address);
    CREATE INDEX IF NOT EXISTS idx_pushed_alerts_time ON pushed_alerts(pushed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trade_intents_time ON trade_intents(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_paper_positions_status ON paper_positions(status, updated_at DESC);
  `);

  const alertColumns = db.prepare('PRAGMA table_info(pushed_alerts)').all();
  const columnNames = new Set(alertColumns.map((column) => column.name));
  if (!columnNames.has('price')) {
    db.exec('ALTER TABLE pushed_alerts ADD COLUMN price REAL');
  }

  const positionColumns = db.prepare('PRAGMA table_info(paper_positions)').all();
  const positionColumnNames = new Set(positionColumns.map((column) => column.name));
  if (!positionColumnNames.has('position_size_usd')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN position_size_usd REAL');
  }
  if (!positionColumnNames.has('token_amount')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN token_amount REAL');
  }

  backfillPaperPositionSizing(db);

  return db;
}

function setRadarMeta(db, key, value) {
  db.prepare(`
    INSERT INTO radar_meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function getRadarMeta(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM radar_meta WHERE key = ?').get(key);
  return row?.value ?? fallback;
}

function ensureStrategySessionMeta(db, { reset = false } = {}) {
  const existingStartedAtTs = getRadarMeta(db, 'strategy_started_at_ts', null);
  if (existingStartedAtTs && !reset) {
    return;
  }

  const nowTs = Math.floor(Date.now() / 1000);
  setRadarMeta(db, 'strategy_started_at_ts', nowTs);
  setRadarMeta(db, 'strategy_started_at', new Date(nowTs * 1000).toISOString());
}

function formatRuntimeSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function getStrategyRuntimeInfo(db) {
  const startedAt = getRadarMeta(db, 'strategy_started_at', null);
  const startedAtTsRaw = getRadarMeta(db, 'strategy_started_at_ts', null);
  const startedAtTs = startedAtTsRaw ? Number(startedAtTsRaw) : 0;
  const strategyRuntimeSeconds =
    startedAtTs > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - startedAtTs) : 0;

  return {
    strategyStartedAt: startedAt,
    strategyRuntimeSeconds,
    strategyRuntimeLabel: formatRuntimeSeconds(strategyRuntimeSeconds),
  };
}

function backfillPaperPositionSizing(db) {
  const rows = db
    .prepare(
      `SELECT id, smart_money, trade_score, entry_price
       FROM paper_positions
       WHERE (position_size_usd IS NULL OR position_size_usd = 0 OR token_amount IS NULL OR token_amount = 0)
         AND entry_price > 0`
    )
    .all();

  const stmt = db.prepare(`
    UPDATE paper_positions
    SET position_size_usd = ?, token_amount = ?
    WHERE id = ?
  `);

  for (const row of rows) {
    const sizing = getPaperPositionSizingByMetrics(
      row.smart_money || 0,
      row.trade_score || 0,
      row.entry_price || 0
    );
    stmt.run(sizing.positionSizeUsd, sizing.tokenAmount, row.id);
  }
}

function toAlertRecord(alert, pushedAt) {
  return {
    chain: alert.token.chain,
    address: alert.token.address,
    signalCount: alert.signalCount || 1,
    name: alert.token.name,
    symbol: alert.token.symbol,
    price: alert.token.price || 0,
    mc: alert.token.mc,
    liq: alert.token.liq,
    volume: alert.token.volume,
    smartMoney: alert.token.sm || 0,
    holders: alert.token.holders || 0,
    buySellRatio: Number(getBuySellMetrics(alert.token).buySellRatio.toFixed(2)),
    ageHours: Number(alert.token.age_h.toFixed(1)),
    change1h: alert.token.chg_1h || 0,
    pctGain: Number(alert.pctGain.toFixed(2)),
    stars: alert.stars || 1,
    narrativeTag: alert.narrativeTag || '无明确叙事',
    category: alert.category || 'other',
    twitter: alert.descInfo?.twitter || alert.token.twitter || '',
    telegram: alert.descInfo?.telegram || alert.token.telegram || '',
    website: alert.descInfo?.website || alert.token.website || '',
    message: alert.msg,
    pushedAt,
  };
}

function persistAlerts(db, alerts, pushedAt) {
  if (!alerts.length) {
    return 0;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO pushed_alerts (
      chain, address, signal_count, name, symbol, price, mc, liq, volume,
      smart_money, holders, buy_sell_ratio, age_hours, change_1h,
      pct_gain, stars, narrative_tag, category, twitter, telegram,
      website, message, pushed_at
    ) VALUES (
      @chain, @address, @signalCount, @name, @symbol, @price, @mc, @liq, @volume,
      @smartMoney, @holders, @buySellRatio, @ageHours, @change1h,
      @pctGain, @stars, @narrativeTag, @category, @twitter, @telegram,
      @website, @message, @pushedAt
    )
  `);

  let inserted = 0;
  for (const alert of alerts) {
    const result = insert.run(toAlertRecord(alert, pushedAt));
    inserted += result.changes;
  }
  return inserted;
}

function normalizeTradeCandidate(input) {
  if (input.token) {
    const token = input.token;
    return {
      signalCount: input.signalCount || 1,
      sm: token.sm || 0,
      liq: token.liq || 0,
      volume: token.volume || 0,
      chg_1h: token.chg_1h || 0,
      buySellRatio: Number(getBuySellMetrics(token).buySellRatio.toFixed(2)),
    };
  }

  return {
    signalCount: input.signalCount || 1,
    sm: input.smartMoney || 0,
    liq: input.liq || 0,
    volume: input.volume || 0,
    chg_1h: input.change1h || 0,
    buySellRatio: Number((input.buySellRatio || 0).toFixed(2)),
  };
}

function getTradeScore(alert) {
  const candidate = normalizeTradeCandidate(alert);
  const parts = [];
  let score = 0;

  if (candidate.sm >= 8) {
    score += 30;
    parts.push('聪明钱>=8 +30');
  } else if (candidate.sm >= 5) {
    score += 24;
    parts.push('聪明钱5-7 +24');
  } else if (candidate.sm >= 3) {
    score += 16;
    parts.push('聪明钱3-4 +16');
  } else if (candidate.sm >= 2) {
    score += 8;
    parts.push('聪明钱=2 +8');
  }

  if (candidate.signalCount <= 1) {
    score += 20;
    parts.push('第1次信号 +20');
  } else if (candidate.signalCount === 2) {
    score += 12;
    parts.push('第2次信号 +12');
  } else if (candidate.signalCount === 3) {
    score += 4;
    parts.push('第3次信号 +4');
  } else {
    score -= 8;
    parts.push('第4次及以上 -8');
  }

  if (candidate.liq >= 20_000) {
    score += 18;
    parts.push('流动性>=20000 +18');
  } else if (candidate.liq >= 10_000) {
    score += 12;
    parts.push('流动性>=10000 +12');
  } else if (candidate.liq >= 5_000) {
    score += 6;
    parts.push('流动性>=5000 +6');
  }

  if (candidate.volume >= 100_000) {
    score += 15;
    parts.push('1h量>=100000 +15');
  } else if (candidate.volume >= 50_000) {
    score += 10;
    parts.push('1h量>=50000 +10');
  } else if (candidate.volume >= 20_000) {
    score += 6;
    parts.push('1h量>=20000 +6');
  }

  if (candidate.buySellRatio >= 1.5) {
    score += 10;
    parts.push('买卖比>=1.5 +10');
  } else if (candidate.buySellRatio >= 1.3) {
    score += 7;
    parts.push('买卖比>=1.3 +7');
  } else if (candidate.buySellRatio >= 1.1) {
    score += 4;
    parts.push('买卖比>=1.1 +4');
  }

  if (candidate.chg_1h >= 80) {
    score -= 20;
    parts.push('1h涨幅过热>=80% -20');
  } else if (candidate.chg_1h >= 50) {
    score -= 12;
    parts.push('1h涨幅过热>=50% -12');
  }

  return {
    score,
    parts,
    buySellRatio: candidate.buySellRatio,
  };
}

function evaluateTradeIntent(alert) {
  const candidate = normalizeTradeCandidate(alert);
  const scoreInfo = getTradeScore(alert);
  const reasons = [];

  if (scoreInfo.score < TRADE_SCORE_THRESHOLD) {
    reasons.push(`交易评分低于 ${TRADE_SCORE_THRESHOLD}`);
  }
  if (candidate.signalCount > TRADE_MAX_SIGNAL_COUNT) {
    reasons.push(`信号次数超过 ${TRADE_MAX_SIGNAL_COUNT}`);
  }
  if (candidate.sm < TRADE_MIN_SMART_MONEY) {
    reasons.push(`聪明钱低于 ${TRADE_MIN_SMART_MONEY}`);
  }
  if (candidate.liq < TRADE_MIN_LIQUIDITY) {
    reasons.push(`流动性低于 ${TRADE_MIN_LIQUIDITY}`);
  }
  if (candidate.volume < TRADE_MIN_VOLUME) {
    reasons.push(`1h成交量低于 ${TRADE_MIN_VOLUME}`);
  }
  if (scoreInfo.buySellRatio < TRADE_MIN_BUY_SELL_RATIO) {
    reasons.push(`买卖比低于 ${TRADE_MIN_BUY_SELL_RATIO}`);
  }

  return {
    tradeScore: scoreInfo.score,
    scoreBreakdown: scoreInfo.parts,
    buySellRatio: scoreInfo.buySellRatio,
    approved: reasons.length === 0,
    decisionReason: reasons.length === 0 ? '满足纸上交易开仓条件' : reasons.join(' | '),
    intentStatus: reasons.length === 0 ? 'approved' : 'rejected',
  };
}

function hasOpenPaperPosition(db, chain, address) {
  const row = db
    .prepare(
      'SELECT id FROM paper_positions WHERE chain = ? AND address = ? AND status = ? LIMIT 1'
    )
    .get(chain, address, 'open');
  return Boolean(row);
}

function getOpenPaperPositionCount(db) {
  return (
    db.prepare('SELECT COUNT(*) AS count FROM paper_positions WHERE status = ?').get('open').count || 0
  );
}

function recordTradeIntent(db, alert, tradePlan, createdAt) {
  db.prepare(`
    INSERT OR IGNORE INTO trade_intents (
      chain, address, signal_count, name, symbol, trade_score, status,
      decision_reason, smart_money, buy_sell_ratio, liquidity, volume,
      price, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    alert.token.chain,
    alert.token.address,
    alert.signalCount,
    alert.token.name,
    alert.token.symbol,
    tradePlan.tradeScore,
    tradePlan.intentStatus,
    tradePlan.decisionReason,
    alert.token.sm || 0,
    tradePlan.buySellRatio,
    alert.token.liq || 0,
    alert.token.volume || 0,
    alert.token.price || 0,
    createdAt
  );
}

function getPaperPositionSizingByMetrics(smartMoney, tradeScore, price) {
  let multiplier = 0.25;

  if (smartMoney >= 8) {
    multiplier = 1;
  } else if (smartMoney >= 5) {
    multiplier = 0.75;
  } else if (smartMoney >= 3) {
    multiplier = 0.5;
  }

  if (tradeScore >= 85) {
    multiplier = Math.min(multiplier + 0.25, 1.25);
  }

  const positionSizeUsd = Number((PAPER_BASE_POSITION_USD * multiplier).toFixed(2));
  const tokenAmount = price > 0 ? Number((positionSizeUsd / price).toFixed(6)) : 0;

  return {
    multiplier,
    positionSizeUsd,
    tokenAmount,
  };
}

function getPaperPositionSizing(alert, tradePlan) {
  return getPaperPositionSizingByMetrics(
    alert.token.sm || 0,
    tradePlan.tradeScore || 0,
    alert.token.price || 0
  );
}

function openPaperPosition(db, alert, tradePlan, createdAt, sizing) {
  const finalSizing = sizing || getPaperPositionSizing(alert, tradePlan);
  db.prepare(`
    INSERT OR IGNORE INTO paper_positions (
      chain, address, name, symbol, entry_signal_count, trade_score, position_size_usd,
      token_amount,
      entry_price, current_price, take_profit_pct, stop_loss_pct, status,
      opened_at, updated_at, smart_money, buy_sell_ratio, liquidity, volume
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    alert.token.chain,
    alert.token.address,
    alert.token.name,
    alert.token.symbol,
    alert.signalCount,
    tradePlan.tradeScore,
    finalSizing.positionSizeUsd,
    finalSizing.tokenAmount,
    alert.token.price || 0,
    alert.token.price || 0,
    PAPER_TAKE_PROFIT_PERCENT,
    PAPER_STOP_LOSS_PERCENT,
    'open',
    createdAt,
    createdAt,
    alert.token.sm || 0,
    tradePlan.buySellRatio,
    alert.token.liq || 0,
    alert.token.volume || 0
  );
}

function updatePaperPositions(db, tokens, updatedAt) {
  const tokenMap = new Map(tokens.map((token) => [`${token.chain}:${token.address}`, token]));
  const openPositions = db
    .prepare('SELECT * FROM paper_positions WHERE status = ? ORDER BY opened_at DESC')
    .all('open');

  const updateStmt = db.prepare(`
    UPDATE paper_positions
    SET current_price = ?, pnl_pct = ?, updated_at = ?
    WHERE id = ?
  `);
  const closeStmt = db.prepare(`
    UPDATE paper_positions
    SET status = ?, current_price = ?, close_price = ?, close_reason = ?,
        pnl_pct = ?, updated_at = ?, closed_at = ?
    WHERE id = ?
  `);

  for (const position of openPositions) {
    const token = tokenMap.get(`${position.chain}:${position.address}`);
    if (!token || !token.price || !position.entry_price) {
      continue;
    }

    const pnlPct = ((token.price - position.entry_price) / position.entry_price) * 100;
    const tpPrice = position.entry_price * (1 + position.take_profit_pct / 100);
    const slPrice = position.entry_price * (1 - position.stop_loss_pct / 100);

    if (token.price >= tpPrice) {
      closeStmt.run(
        'closed',
        token.price,
        token.price,
        `take_profit_${position.take_profit_pct}`,
        Number(pnlPct.toFixed(2)),
        updatedAt,
        updatedAt,
        position.id
      );
      continue;
    }

    if (token.price <= slPrice) {
      closeStmt.run(
        'closed',
        token.price,
        token.price,
        `stop_loss_${position.stop_loss_pct}`,
        Number(pnlPct.toFixed(2)),
        updatedAt,
        updatedAt,
        position.id
      );
      continue;
    }

    updateStmt.run(token.price, Number(pnlPct.toFixed(2)), updatedAt, position.id);
  }
}

function getPaperAccountSummary(db) {
  const openRows = db
    .prepare(
      'SELECT position_size_usd, token_amount, current_price FROM paper_positions WHERE status = ?'
    )
    .all('open');
  const closedRows = db
    .prepare(
      'SELECT position_size_usd, token_amount, current_price, close_price FROM paper_positions WHERE status = ?'
    )
    .all('closed');

  const openBuyUsd = openRows.reduce((sum, row) => sum + Number(row.position_size_usd || 0), 0);
  const openMarketValueUsd = openRows.reduce(
    (sum, row) => sum + Number((row.token_amount || 0) * (row.current_price || 0)),
    0
  );
  const openPnLUsd = openMarketValueUsd - openBuyUsd;

  const closedBuyUsd = closedRows.reduce((sum, row) => sum + Number(row.position_size_usd || 0), 0);
  const closedSellUsd = closedRows.reduce(
    (sum, row) => sum + Number((row.token_amount || 0) * (row.close_price || row.current_price || 0)),
    0
  );
  const closedPnLUsd = closedSellUsd - closedBuyUsd;

  const cashBalanceUsd = PAPER_TOTAL_CAPITAL_USD - openBuyUsd + closedPnLUsd;
  const equityUsd = cashBalanceUsd + openMarketValueUsd;
  const totalPnLUsd = openPnLUsd + closedPnLUsd;
  const capitalUsagePct =
    PAPER_TOTAL_CAPITAL_USD > 0 ? (openBuyUsd / PAPER_TOTAL_CAPITAL_USD) * 100 : 0;

  return {
    totalCapitalUsd: Number(PAPER_TOTAL_CAPITAL_USD.toFixed(2)),
    cashBalanceUsd: Number(cashBalanceUsd.toFixed(2)),
    availableUsd: Number(cashBalanceUsd.toFixed(2)),
    usedCapitalUsd: Number(openBuyUsd.toFixed(2)),
    equityUsd: Number(equityUsd.toFixed(2)),
    capitalUsagePct: Number(capitalUsagePct.toFixed(2)),
    openBuyUsd: Number(openBuyUsd.toFixed(2)),
    openMarketValueUsd: Number(openMarketValueUsd.toFixed(2)),
    openPnLUsd: Number(openPnLUsd.toFixed(2)),
    closedBuyUsd: Number(closedBuyUsd.toFixed(2)),
    closedSellUsd: Number(closedSellUsd.toFixed(2)),
    closedPnLUsd: Number(closedPnLUsd.toFixed(2)),
    totalPnLUsd: Number(totalPnLUsd.toFixed(2)),
  };
}

function processTradePlans(db, alerts, tokens, createdAt) {
  updatePaperPositions(db, tokens, createdAt);

  const candidates = alerts
    .map((alert) => ({ alert, tradePlan: evaluateTradeIntent(alert) }))
    .sort((left, right) => {
      if ((right.tradePlan.tradeScore || 0) !== (left.tradePlan.tradeScore || 0)) {
        return (right.tradePlan.tradeScore || 0) - (left.tradePlan.tradeScore || 0);
      }
      if ((right.alert.token.sm || 0) !== (left.alert.token.sm || 0)) {
        return (right.alert.token.sm || 0) - (left.alert.token.sm || 0);
      }
      return (right.alert.pctGain || 0) - (left.alert.pctGain || 0);
    });

  for (const { alert, tradePlan } of candidates) {
    if (hasOpenPaperPosition(db, alert.token.chain, alert.token.address)) {
      tradePlan.approved = false;
      tradePlan.intentStatus = 'skipped';
      tradePlan.decisionReason = '已有打开的纸上持仓';
    }

    const sizing = getPaperPositionSizing(alert, tradePlan);
    if (tradePlan.approved) {
      const account = getPaperAccountSummary(db);
      const openCount = getOpenPaperPositionCount(db);
      const nextUsedCapitalUsd = account.usedCapitalUsd + sizing.positionSizeUsd;
      const nextUsagePct =
        PAPER_TOTAL_CAPITAL_USD > 0 ? (nextUsedCapitalUsd / PAPER_TOTAL_CAPITAL_USD) * 100 : 0;

      if (openCount >= PAPER_MAX_OPEN_POSITIONS) {
        tradePlan.approved = false;
        tradePlan.intentStatus = 'rejected';
        tradePlan.decisionReason = `打开持仓数已达上限 ${PAPER_MAX_OPEN_POSITIONS}`;
      } else if (nextUsagePct > PAPER_MAX_CAPITAL_USAGE_PCT) {
        tradePlan.approved = false;
        tradePlan.intentStatus = 'rejected';
        tradePlan.decisionReason = `资金使用率将达 ${nextUsagePct.toFixed(1)}%，超过上限 ${PAPER_MAX_CAPITAL_USAGE_PCT}%`;
      }
    }

    if (tradePlan.approved) {
      const account = getPaperAccountSummary(db);
      if (sizing.positionSizeUsd > account.availableUsd) {
        tradePlan.approved = false;
        tradePlan.intentStatus = 'rejected';
        tradePlan.decisionReason = `可用余额不足，需 ${sizing.positionSizeUsd.toFixed(2)} USD，剩余 ${account.availableUsd.toFixed(2)} USD`;
      }
    }

    recordTradeIntent(db, alert, tradePlan, createdAt);

    if (tradePlan.approved) {
      openPaperPosition(db, alert, tradePlan, createdAt, sizing);
    }

    alert.tradePlan = tradePlan;
  }
}

function getPaperTradeSummary(db) {
  const openCount = db
    .prepare('SELECT COUNT(*) AS count FROM paper_positions WHERE status = ?')
    .get('open').count;
  const closed = db
    .prepare('SELECT COUNT(*) AS count FROM paper_positions WHERE status = ?')
    .get('closed').count;
  const wins = db
    .prepare('SELECT COUNT(*) AS count FROM paper_positions WHERE status = ? AND pnl_pct > 0')
    .get('closed').count;
  const account = getPaperAccountSummary(db);

  return {
    openCount: openCount || 0,
    closedCount: closed || 0,
    winCount: wins || 0,
    winRate: closed > 0 ? Number(((wins / closed) * 100).toFixed(1)) : 0,
    openValueUsd: account.openMarketValueUsd,
    openCostUsd: account.openBuyUsd,
    openPnLUsd: account.openPnLUsd,
    closedCostUsd: account.closedBuyUsd,
    closedValueUsd: account.closedSellUsd,
    closedPnLUsd: account.closedPnLUsd,
    totalCapitalUsd: account.totalCapitalUsd,
    cashBalanceUsd: account.cashBalanceUsd,
    availableUsd: account.availableUsd,
    usedCapitalUsd: account.usedCapitalUsd,
    equityUsd: account.equityUsd,
    capitalUsagePct: account.capitalUsagePct,
    totalPnLUsd: account.totalPnLUsd,
  };
}

function getPaperPositions(db, status = 'open', limit = 20) {
  const rows = db
    .prepare(
      `SELECT *
       FROM paper_positions
       WHERE status = ?
       ORDER BY updated_at DESC, opened_at DESC
       LIMIT ?`
    )
    .all(status, limit);

  return rows.map((row) => {
    const currentValueUsd = Number(((row.token_amount || 0) * (row.current_price || 0)).toFixed(2));
    const pnlUsd = Number((currentValueUsd - Number(row.position_size_usd || 0)).toFixed(2));

    return {
      id: row.id,
      chain: row.chain,
      address: row.address,
      name: row.name,
      symbol: row.symbol,
      entrySignalCount: row.entry_signal_count,
      tradeScore: row.trade_score,
      positionSizeUsd: Number(row.position_size_usd || 0),
      tokenAmount: Number(row.token_amount || 0),
      entryPrice: row.entry_price,
      currentPrice: row.current_price,
      currentValueUsd,
      pnlPct: row.pnl_pct,
      pnlUsd,
      takeProfitPct: row.take_profit_pct,
      stopLossPct: row.stop_loss_pct,
      status: row.status,
      smartMoney: row.smart_money,
      buySellRatio: row.buy_sell_ratio,
      liquidity: row.liquidity,
      volume: row.volume,
      openedAt: row.opened_at ? new Date(row.opened_at * 1000).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at * 1000).toISOString() : null,
      closedAt: row.closed_at ? new Date(row.closed_at * 1000).toISOString() : null,
      closePrice: row.close_price,
      closeReason: row.close_reason || '',
    };
  });
}

function enrichAlertsWithTradeState(db, alerts) {
  const intentStmt = db.prepare(`
    SELECT trade_score, status, decision_reason, created_at
    FROM trade_intents
    WHERE chain = ? AND address = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `);
  const positionStmt = db.prepare(`
    SELECT *
    FROM paper_positions
    WHERE chain = ? AND address = ?
    ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, updated_at DESC, id DESC
    LIMIT 1
  `);

  return alerts.map((alert) => {
    const intent = intentStmt.get(alert.chain, alert.address);
    const position = positionStmt.get(alert.chain, alert.address);
    const previewPlan = evaluateTradeIntent(alert);

    return {
      ...alert,
      tradeScore: intent?.trade_score ?? previewPlan.tradeScore,
      tradeDecisionStatus: intent?.status || previewPlan.intentStatus,
      tradeDecisionReason: intent?.decision_reason || previewPlan.decisionReason,
      tradeDecisionAt: intent?.created_at
        ? new Date(intent.created_at * 1000).toISOString()
        : null,
      paperPositionStatus: position?.status || '',
      paperPositionSizeUsd: position?.position_size_usd ?? null,
      paperTokenAmount: position?.token_amount ?? null,
      paperEntryPrice: position?.entry_price ?? null,
      paperCurrentPrice: position?.current_price ?? null,
      paperPnLPct: position?.pnl_pct ?? null,
      paperOpenedAt: position?.opened_at ? new Date(position.opened_at * 1000).toISOString() : null,
      paperClosedAt: position?.closed_at ? new Date(position.closed_at * 1000).toISOString() : null,
      paperCloseReason: position?.close_reason || '',
      paperTakeProfitPct: position?.take_profit_pct ?? PAPER_TAKE_PROFIT_PERCENT,
      paperStopLossPct: position?.stop_loss_pct ?? PAPER_STOP_LOSS_PERCENT,
    };
  });
}

function getRecentPersistedAlerts(db, limit = 50) {
  const fetchLimit = Math.min(Math.max(limit * 20, 200), 2_000);
  const rows = db.prepare(`
    SELECT
      chain,
      address,
      signal_count,
      name,
      symbol,
      price,
      mc,
      liq,
      volume,
      smart_money,
      holders,
      buy_sell_ratio,
      age_hours,
      change_1h,
      pct_gain,
      stars,
      narrative_tag,
      category,
      twitter,
      telegram,
      website,
      message,
      pushed_at
    FROM pushed_alerts
    ORDER BY pushed_at DESC, id DESC
    LIMIT ?
  `).all(fetchLimit);

  const groups = new Map();

  for (const row of rows) {
    const key = `${row.chain}:${row.address}`;
    const pushedAt = new Date(row.pushed_at * 1000).toISOString();
    const historyItem = {
      signalCount: row.signal_count,
      pushedAt,
      pctGain: row.pct_gain,
      price: row.price,
    };

    if (!groups.has(key)) {
      if (groups.size >= limit) {
        continue;
      }

      groups.set(key, {
        address: row.address,
        name: row.name,
        symbol: row.symbol,
        chain: row.chain,
        price: row.price,
        mc: row.mc,
        liq: row.liq,
        volume: row.volume,
        smartMoney: row.smart_money,
        holders: row.holders,
        buySellRatio: row.buy_sell_ratio,
        ageHours: row.age_hours,
        change1h: row.change_1h,
        pctGain: row.pct_gain,
        stars: row.stars,
        narrativeTag: row.narrative_tag,
        category: row.category,
        signalCount: row.signal_count,
        occurrenceCount: 1,
        twitter: row.twitter || '',
        telegram: row.telegram || '',
        website: row.website || '',
        message: row.message,
        pushedAt,
        firstPushedAt: pushedAt,
        latestPushedAt: pushedAt,
        signalHistory: [historyItem],
      });
      continue;
    }

    const group = groups.get(key);
    group.occurrenceCount += 1;
    group.firstPushedAt = pushedAt;
    group.signalHistory.push(historyItem);
  }

  const groupedAlerts = [...groups.values()].sort((a, b) => {
    const timeDiff =
      new Date(b.latestPushedAt || b.pushedAt).getTime() -
      new Date(a.latestPushedAt || a.pushedAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }

    if ((b.smartMoney || 0) !== (a.smartMoney || 0)) {
      return (b.smartMoney || 0) - (a.smartMoney || 0);
    }

    if ((b.occurrenceCount || 0) !== (a.occurrenceCount || 0)) {
      return (b.occurrenceCount || 0) - (a.occurrenceCount || 0);
    }

    return (b.pctGain || 0) - (a.pctGain || 0);
  });

  return enrichAlertsWithTradeState(db, groupedAlerts);
}

export function getPersistedRadarSnapshot(limit = 60) {
  const db = initDb();
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 120) : 60;
  const alerts = getRecentPersistedAlerts(db, safeLimit);
  const totalPersisted =
    db.prepare('SELECT COUNT(*) AS count FROM pushed_alerts').get().count || 0;
  const totalPersistedTokens =
    db.prepare("SELECT COUNT(DISTINCT chain || ':' || address) AS count FROM pushed_alerts").get()
      .count || 0;
  const scannedAt = getRadarMeta(db, 'last_scanned_at', null);
  const runtimeInfo = getStrategyRuntimeInfo(db);
  const paperSummary = getPaperTradeSummary(db);
  const paperPositions = getPaperPositions(db, 'open', 20);
  const closedPaperPositions = getPaperPositions(db, 'closed', 30);
  db.close();

  return {
    pushed: 0,
    found: alerts.length,
    scanned: 0,
    scannedAt,
    strategyStartedAt: runtimeInfo.strategyStartedAt,
    strategyRuntimeSeconds: runtimeInfo.strategyRuntimeSeconds,
    strategyRuntimeLabel: runtimeInfo.strategyRuntimeLabel,
    persistedThisRound: 0,
    totalPersisted,
    totalPersistedTokens,
    paperSummary,
    paperPositions,
    closedPaperPositions,
    summary: {
      triggered: alerts.length,
      ready: 0,
      watching: 0,
      scanning: 0,
    },
    alerts,
    rows: [],
    config: getRadarConfig(),
  };
}

async function fetchDexScreenerPrice(address) {
  try {
    const json = await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      {},
      8_000
    );
    const pairs = json.pairs || [];
    if (pairs.length === 0) {
      return null;
    }

    const bestPair = [...pairs].sort((left, right) => {
      const leftLiquidity = Number(left?.liquidity?.usd || 0);
      const rightLiquidity = Number(right?.liquidity?.usd || 0);
      return rightLiquidity - leftLiquidity;
    })[0];
    const price = Number(bestPair?.priceUsd || 0);
    return price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function fetchTrackedLivePrices(trackedTokens) {
  const priceMap = new Map();
  if (!trackedTokens.length) {
    return priceMap;
  }

  const targetKeys = new Set(trackedTokens.map((token) => `${token.chain}:${token.address}`));

  try {
    const gmgnTokens = await fetchNewTokens();
    for (const token of gmgnTokens) {
      const key = `${token.chain}:${token.address}`;
      if (targetKeys.has(key) && token.price > 0) {
        priceMap.set(key, Number(token.price));
      }
    }
  } catch {
    // Ignore and fall back to DexScreener when GMGN quote fetch fails.
  }

  const missingTokens = trackedTokens.filter(
    (token) => !priceMap.has(`${token.chain}:${token.address}`)
  );

  await Promise.all(
    missingTokens.map(async (token) => {
      const price = await fetchDexScreenerPrice(token.address);
      if (price != null && price > 0) {
        priceMap.set(`${token.chain}:${token.address}`, price);
      }
    })
  );

  return priceMap;
}

function applyLivePriceToPaperPosition(position, livePrice) {
  if (!livePrice || !position.entryPrice) {
    return position;
  }

  const currentValueUsd = Number(((position.tokenAmount || 0) * livePrice).toFixed(2));
  const pnlUsd = Number((currentValueUsd - Number(position.positionSizeUsd || 0)).toFixed(2));
  const pnlPct =
    position.entryPrice > 0
      ? Number((((livePrice - position.entryPrice) / position.entryPrice) * 100).toFixed(2))
      : position.pnlPct;

  return {
    ...position,
    currentPrice: livePrice,
    currentValueUsd,
    pnlUsd,
    pnlPct,
  };
}

function rebuildPaperSummaryWithLivePositions(baseSummary, liveOpenPositions) {
  const totalCapitalUsd = Number(baseSummary?.totalCapitalUsd || PAPER_TOTAL_CAPITAL_USD);
  const closedPnLUsd = Number(baseSummary?.closedPnLUsd || 0);
  const openCostUsd = Number(
    liveOpenPositions.reduce((sum, position) => sum + Number(position.positionSizeUsd || 0), 0).toFixed(2)
  );
  const openValueUsd = Number(
    liveOpenPositions.reduce((sum, position) => sum + Number(position.currentValueUsd || 0), 0).toFixed(2)
  );
  const openPnLUsd = Number((openValueUsd - openCostUsd).toFixed(2));
  const cashBalanceUsd = Number((totalCapitalUsd - openCostUsd + closedPnLUsd).toFixed(2));
  const equityUsd = Number((cashBalanceUsd + openValueUsd).toFixed(2));
  const totalPnLUsd = Number((closedPnLUsd + openPnLUsd).toFixed(2));
  const capitalUsagePct =
    totalCapitalUsd > 0 ? Number(((openCostUsd / totalCapitalUsd) * 100).toFixed(2)) : 0;

  return {
    ...baseSummary,
    openCount: liveOpenPositions.length,
    openCostUsd,
    openValueUsd,
    openPnLUsd,
    cashBalanceUsd,
    availableUsd: cashBalanceUsd,
    usedCapitalUsd: openCostUsd,
    equityUsd,
    capitalUsagePct,
    totalPnLUsd,
  };
}

export async function getRealtimeRadarSnapshot(limit = 60) {
  const snapshot = getPersistedRadarSnapshot(limit);
  const trackedTokens = [];
  const seen = new Set();

  for (const position of snapshot.paperPositions || []) {
    const key = `${position.chain}:${position.address}`;
    if (!seen.has(key)) {
      seen.add(key);
      trackedTokens.push({ chain: position.chain, address: position.address });
    }
  }

  for (const alert of (snapshot.alerts || []).slice(0, 20)) {
    const key = `${alert.chain}:${alert.address}`;
    if (!seen.has(key)) {
      seen.add(key);
      trackedTokens.push({ chain: alert.chain, address: alert.address });
    }
  }

  if (!trackedTokens.length) {
    return {
      ...snapshot,
      liveUpdatedAt: new Date().toISOString(),
      liveMode: 'server_push',
    };
  }

  const livePriceMap = await fetchTrackedLivePrices(trackedTokens);
  const paperPositions = (snapshot.paperPositions || []).map((position) =>
    applyLivePriceToPaperPosition(
      position,
      livePriceMap.get(`${position.chain}:${position.address}`) || null
    )
  );
  const paperPositionMap = new Map(
    paperPositions.map((position) => [`${position.chain}:${position.address}`, position])
  );
  const alerts = (snapshot.alerts || []).map((alert) => {
    const key = `${alert.chain}:${alert.address}`;
    const livePrice = livePriceMap.get(key);
    const livePosition = paperPositionMap.get(key);

    return {
      ...alert,
      price: livePrice || alert.price,
      paperCurrentPrice: livePosition?.currentPrice ?? alert.paperCurrentPrice,
      paperPnLPct: livePosition?.pnlPct ?? alert.paperPnLPct,
    };
  });

  return {
    ...snapshot,
    paperSummary: rebuildPaperSummaryWithLivePositions(snapshot.paperSummary, paperPositions),
    paperPositions,
    alerts,
    liveUpdatedAt: new Date().toISOString(),
    liveMode: 'server_push',
  };
}

function normalizeTheme(name = '', symbol = '') {
  const noise = new Set([
    'token',
    'coin',
    'inu',
    'swap',
    'finance',
    'protocol',
    'dao',
    'defi',
    'nft',
    'meta',
    'verse',
    'fi',
    'ai',
    'pepe',
    'wojak',
    'chad',
    'based',
  ]);

  let text = `${name} ${symbol}`.trim();
  text = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  text = text.replace(/\d+x?/g, ' ');
  text = text.replace(/[^a-z\s]/g, ' ');

  const words = text
    .split(/\s+/)
    .filter((word) => word.length > 1 && !noise.has(word));

  if (words.length === 0) {
    return name.toLowerCase().trim();
  }

  return [...new Set(words)].sort().join(' ');
}

function bigramSimilarity(a, b) {
  const toBigrams = (value) => {
    const normalized = ` ${value} `;
    const bigrams = new Map();
    for (let i = 0; i < normalized.length - 1; i += 1) {
      const gram = normalized.slice(i, i + 2);
      bigrams.set(gram, (bigrams.get(gram) || 0) + 1);
    }
    return bigrams;
  };

  const aBigrams = toBigrams(a);
  const bBigrams = toBigrams(b);
  let overlap = 0;

  for (const [gram, count] of aBigrams.entries()) {
    overlap += Math.min(count, bBigrams.get(gram) || 0);
  }

  const total = [...aBigrams.values()].reduce((sum, count) => sum + count, 0) +
    [...bBigrams.values()].reduce((sum, count) => sum + count, 0);

  return total === 0 ? 0 : (2 * overlap) / total;
}

function isSimilarTheme(theme1, theme2, threshold = 0.7) {
  if (theme1 === theme2) {
    return true;
  }

  if (theme1.includes(theme2) || theme2.includes(theme1)) {
    return true;
  }

  const words1 = new Set(theme1.split(' ').filter(Boolean));
  const words2 = new Set(theme2.split(' ').filter(Boolean));
  const overlap = [...words1].filter((word) => words2.has(word)).length;
  if (words1.size > 0 && words2.size > 0) {
    const ratio = overlap / Math.min(words1.size, words2.size);
    if (ratio >= 0.6) {
      return true;
    }
  }

  return bigramSimilarity(theme1, theme2) >= threshold;
}

function classifyNarrative(name, symbol, chain) {
  const text = `${name} ${symbol}`.toLowerCase();

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return ['spam', null];
    }
  }

  const matchedMt = [...MUSK_TRUMP_KEYWORDS].filter((keyword) =>
    text.includes(keyword.toLowerCase())
  );
  if (matchedMt.length === 0) {
    for (const pattern of MUSK_TRUMP_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        matchedMt.push(match[0]);
      }
    }
  }
  if (matchedMt.length > 0) {
    if (['eth', 'ethereum', 'sol', 'solana', 'bsc', 'base'].includes(chain)) {
      return ['musk_trump', matchedMt];
    }
  }

  const matchedBc = [...BINANCE_CZ_KEYWORDS].filter((keyword) =>
    text.includes(keyword.toLowerCase())
  );
  if (matchedBc.length === 0) {
    for (const pattern of BINANCE_CZ_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        matchedBc.push(match[0]);
      }
    }
  }
  if (matchedBc.length > 0) {
    if (chain === 'bsc') {
      return ['binance_cz', matchedBc];
    }
    return ['binance_cz_wrong_chain', matchedBc];
  }

  const matchedCv = [...CELEBRITY_VIRAL_KEYWORDS].filter((keyword) =>
    text.includes(keyword.toLowerCase())
  );
  if (matchedCv.length === 0) {
    for (const pattern of CELEBRITY_VIRAL_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        matchedCv.push(match[0]);
      }
    }
  }
  if (matchedCv.length > 0) {
    return ['celebrity_viral', matchedCv];
  }

  return ['check_novelty', null];
}

function isTokenSeen(db, address) {
  const row = db
    .prepare('SELECT address FROM tokens_seen WHERE address = ?')
    .get(address);
  return Boolean(row);
}

function recordToken(
  db,
  address,
  chain,
  name,
  symbol,
  theme,
  category,
  marketCap,
  pushed = false
) {
  const existing = db
    .prepare('SELECT seen_count FROM tokens_seen WHERE address = ?')
    .get(address);

  if (existing) {
    db.prepare(`
      UPDATE tokens_seen
      SET seen_count = ?, market_cap = ?, category = ?
      WHERE address = ?
    `).run(existing.seen_count + 1, marketCap, category, address);
    return;
  }

  db.prepare(`
    INSERT INTO tokens_seen (
      address, chain, name, symbol, narrative_theme, category,
      first_seen_at, market_cap, pushed, seen_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    address,
    chain,
    name,
    symbol,
    theme,
    category,
    Math.floor(Date.now() / 1000),
    marketCap,
    pushed ? 1 : 0
  );
}

function checkNarrativeNovelty(db, theme, name, address, chain) {
  const now = Math.floor(Date.now() / 1000);
  const heatWindow = 1800;
  const heatThreshold = 2;

  const exact = db
    .prepare(`
      SELECT id, theme, first_token_name, first_token_address, first_chain,
             first_seen_at, token_count, last_seen_at
      FROM narratives WHERE theme = ?
    `)
    .get(theme);

  if (exact) {
    db.prepare(`
      UPDATE narratives
      SET token_count = ?, last_seen_at = ?
      WHERE theme = ?
    `).run(exact.token_count + 1, now, theme);

    if (
      (now - exact.first_seen_at < heatWindow &&
        exact.token_count + 1 >= heatThreshold) ||
      (now - exact.last_seen_at < heatWindow &&
        exact.token_count + 1 >= heatThreshold)
    ) {
      return ['heating', exact];
    }

    return ['existing', exact];
  }

  const recentThemes = db
    .prepare(`
      SELECT id, theme, first_token_name, first_token_address, first_chain,
             first_seen_at, token_count, last_seen_at
      FROM narratives
      ORDER BY last_seen_at DESC
      LIMIT 1000
    `)
    .all();

  for (const row of recentThemes) {
    if (!isSimilarTheme(theme, row.theme)) {
      continue;
    }

    db.prepare(`
      UPDATE narratives
      SET token_count = ?, last_seen_at = ?
      WHERE id = ?
    `).run(row.token_count + 1, now, row.id);

    if (now - row.last_seen_at < heatWindow && row.token_count + 1 >= heatThreshold) {
      return ['heating', row];
    }

    return ['existing', row];
  }

  db.prepare(`
    INSERT INTO narratives (
      theme, first_token_name, first_token_address, first_chain,
      first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(theme, name, address, chain, now, now);

  return ['novel', null];
}

async function tgSend(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) {
    log(`[TG] 缺少配置，跳过推送: ${text.slice(0, 60)}`);
    return false;
  }

  const payload = {
    chat_id: TG_CHAT_ID,
    text,
    parse_mode: 'Markdown',
  };

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      }
    );
    const result = await response.json();

    if (result.ok) {
      return true;
    }

    if (
      String(result.description || '')
        .toLowerCase()
        .includes("can't parse")
    ) {
      const fallback = await fetch(
        `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TG_CHAT_ID, text }),
          signal: AbortSignal.timeout(10_000),
        }
      );
      const fallbackResult = await fallback.json();
      return Boolean(fallbackResult.ok);
    }

    log(`[TG] 推送失败: ${result.description || 'unknown error'}`);
    return false;
  } catch (error) {
    log(`[TG] 发送异常: ${error.message}`);
    return false;
  }
}

async function gmgnGet(url) {
  try {
    const json = await fetchJson(url, { headers: GMGN_HEADERS });
    return json.data || {};
  } catch {
    return {};
  }
}

async function fetchTokenDescription(chain, address) {
  let description = '';

  if (chain === 'sol' || chain === 'solana') {
    try {
      const json = await fetchJson(
        `https://frontend-api-v3.pump.fun/coins/${address}`,
        {},
        8_000
      );
      return {
        description: (json.description || '').trim(),
        twitter: json.twitter || '',
        telegram: json.telegram || '',
        website: json.website || '',
      };
    } catch {
      // ignore
    }
  }

  try {
    const json = await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      {},
      8_000
    );
    const pairs = json.pairs || [];
    if (pairs.length === 0) {
      return { description, twitter: '', telegram: '', website: '' };
    }

    const info = pairs[0].info || {};
    const socials = info.socials || [];
    const websites = info.websites || [];

    let twitter = '';
    let telegram = '';
    let website = '';

    for (const social of socials) {
      if (social.type === 'twitter') {
        twitter = social.url || '';
      }
      if (social.type === 'telegram') {
        telegram = social.url || '';
      }
    }

    for (const site of websites) {
      if (String(site.label || '').toLowerCase() === 'website') {
        website = site.url || '';
      }
    }

    return { description, twitter, telegram, website };
  } catch {
    return { description, twitter: '', telegram: '', website: '' };
  }
}

function mapToken(chain, token, overrides = {}) {
  const marketCap = Number(token.market_cap || token.fdv || 0);
  const liquidity = Number(token.liquidity || 0);
  const openTs = Number(token.open_timestamp || 0);
  const ageHours =
    openTs > 0 ? (Date.now() / 1000 - openTs) / 3600 : Number.POSITIVE_INFINITY;

  return {
    address: token.address || '',
    chain,
    name: token.name || '?',
    symbol: token.symbol || '?',
    mc: marketCap,
    liq: liquidity,
    volume: Number(token.volume || 0),
    holders: Number(token.holder_count || 0),
    sm: Number(token.smart_degen_count || 0),
    chg_1h: Number(token.price_change_percent1h || 0),
    chg_24h: Number(token.price_change_percent || 0),
    age_h: ageHours,
    price: Number(token.price || 0),
    buys_1h: Number(token.buys || 0),
    sells_1h: Number(token.sells || 0),
    twitter: token.twitter_username || '',
    website: token.website || '',
    telegram: token.telegram || '',
    ...overrides,
  };
}

function hasAnySocial(token, descInfo) {
  return Boolean(
    token.twitter ||
      token.website ||
      token.telegram ||
      descInfo.twitter ||
      descInfo.website ||
      descInfo.telegram
  );
}

function getBuySellMetrics(token) {
  const buyCount = token.buys_1h || token.buys || 0;
  const sellCount = token.sells_1h || token.sells || 0;
  const buySellRatio = buyCount / Math.max(sellCount, 1);

  return { buyCount, sellCount, buySellRatio };
}

function getPushQualityResult(token, descInfo = {}) {
  const reasons = [];
  const { buyCount, sellCount, buySellRatio } = getBuySellMetrics(token);

  if (token.liq < PUSH_MIN_LIQUIDITY) {
    reasons.push(`流动性低于 ${PUSH_MIN_LIQUIDITY}`);
  }

  if (token.holders < PUSH_MIN_HOLDERS) {
    reasons.push(`持有人低于 ${PUSH_MIN_HOLDERS}`);
  }

  if (token.volume < PUSH_MIN_VOLUME) {
    reasons.push(`1h成交量低于 ${PUSH_MIN_VOLUME}`);
  }

  if (buyCount <= sellCount || buySellRatio < PUSH_MIN_BUY_SELL_RATIO) {
    reasons.push(`买卖比低于 ${PUSH_MIN_BUY_SELL_RATIO}`);
  }

  if (REQUIRE_SOCIALS && !hasAnySocial(token, descInfo)) {
    reasons.push('缺少社交或官网链接');
  }

  return {
    pass: reasons.length === 0,
    reasons,
    buyCount,
    sellCount,
    buySellRatio,
    hasSocials: hasAnySocial(token, descInfo),
  };
}

function passesPushQualityGate(token, descInfo) {
  return getPushQualityResult(token, descInfo).pass;
}

function getMomentumState(token) {
  const snapshots = MOMENTUM_TRACKER.get(token.address) || [];
  const recent = snapshots.slice(-MOMENTUM_CONSECUTIVE_UP);
  const rounds = recent.length;

  let consecutiveUp = rounds >= MOMENTUM_CONSECUTIVE_UP;
  let volIncreasing = rounds >= 2;

  for (let i = 1; i < recent.length; i += 1) {
    const prevMc = recent[i - 1].mc;
    const currMc = recent[i].mc;
    if (prevMc <= 0 || currMc <= prevMc) {
      consecutiveUp = false;
      break;
    }
  }

  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i].buys < recent[i - 1].buys * 0.8) {
      volIncreasing = false;
      break;
    }
  }

  const firstMc = recent[0]?.mc || 0;
  const lastMc = recent[recent.length - 1]?.mc || 0;
  const pctGain = firstMc > 0 ? ((lastMc - firstMc) / firstMc) * 100 : 0;

  return {
    snapshots,
    rounds,
    consecutiveUp,
    volIncreasing,
    pctGain,
  };
}

async function fetchNewTokens() {
  const allTokens = [];
  const seenAddrs = new Set();
  const chains = ['sol'];

  for (const chain of chains) {
    const urls = [
      `https://gmgn.ai/defi/quotation/v1/rank/${chain}/swaps/1h?orderby=open_timestamp&direction=desc&limit=100`,
      `https://gmgn.ai/defi/quotation/v1/rank/${chain}/swaps/1h?orderby=swaps&direction=desc&limit=50`,
    ];

    for (const url of urls) {
      const data = await gmgnGet(url);
      const rank = data.rank || [];

      for (const token of rank) {
        const mapped = mapToken(chain, token);
        if (!mapped.address || seenAddrs.has(mapped.address)) {
          continue;
        }
        if (
          mapped.mc < MIN_MARKET_CAP ||
          mapped.liq < MIN_LIQUIDITY ||
          mapped.mc > MAX_MARKET_CAP
        ) {
          continue;
        }

        seenAddrs.add(mapped.address);
        allTokens.push(mapped);
      }

      await sleep(300);
    }
  }

  return allTokens;
}

async function checkTokenSafety(chain, address) {
  if (chain === 'sol' || chain === 'solana') {
    try {
      const json = await fetchJson(
        `https://api.rugcheck.xyz/v1/tokens/${address}/report`,
        {},
        10_000
      );
      const mint = json.mintAuthority;
      const freeze = json.freezeAuthority;
      return {
        safe: !mint && !freeze,
        score: json.score ?? 999,
        mint: mint != null,
        freeze: freeze != null,
      };
    } catch {
      return { safe: false, reason: '无法检查' };
    }
  }

  const chainMap = { ethereum: '1', eth: '1', bsc: '56', base: '8453' };
  const chainId = chainMap[chain] || '1';

  try {
    const json = await fetchJson(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`,
      {},
      10_000
    );
    const result = json.result || {};
    const data = result[address.toLowerCase()] || result[address] || {};
    if (!data || Object.keys(data).length === 0) {
      return { safe: false, reason: '无法检查' };
    }

    const honeypot = data.is_honeypot === '1';
    const mintable = data.is_mintable === '1';

    return {
      safe: !honeypot && !mintable,
      honeypot,
      mintable,
      sell_tax: Number(data.sell_tax || 0),
      buy_tax: Number(data.buy_tax || 0),
    };
  } catch {
    return { safe: false, reason: '无法检查' };
  }
}

function classifyStars(token, category, matchedKeywords, descInfo) {
  const isFlap = token.launchpad === 'flap';

  if (category === 'musk_trump') {
    return {
      stars: 3,
      narrativeTag: `马斯克/川普概念 (${matchedKeywords.slice(0, 3).join(', ')})`,
    };
  }

  if (category === 'binance_cz') {
    return {
      stars: 3,
      narrativeTag: `币安/CZ概念 (${matchedKeywords.slice(0, 3).join(', ')})`,
    };
  }

  if (category === 'celebrity_viral') {
    return {
      stars: 2,
      narrativeTag: `名人/热点 (${matchedKeywords.slice(0, 3).join(', ')})`,
    };
  }

  if (isFlap) {
    const communityTags = [];
    if (descInfo.twitter) {
      communityTags.push('有推特');
    }
    if (descInfo.telegram) {
      communityTags.push('有TG群');
    }
    if (descInfo.website) {
      communityTags.push('有官网');
    }

    const stars = communityTags.length > 0 ? 3 : 2;
    const suffix =
      communityTags.length > 0
        ? ` | ${communityTags.join(' ')}`
        : ' | 无社区链接';

    return {
      stars,
      narrativeTag: `FLAP社区币${suffix}`,
    };
  }

  const theme = normalizeTheme(token.name, token.symbol);
  const themeWords = theme
    .split(' ')
    .filter((word) => word.length > 2 && !COMMON_NOISE_WORDS.has(word));

  if (themeWords.length >= 2) {
    return { stars: 2, narrativeTag: `叙事: ${theme}` };
  }

  return { stars: 1, narrativeTag: '无明确叙事' };
}

function formatMomentumAlert(
  token,
  pctGain,
  rounds,
  volUp,
  stars,
  narrativeTag,
  descInfo,
  seenCount
) {
  const chainMap = { sol: 'SOL', eth: 'ETH', bsc: 'BSC', base: 'BASE' };
  const chainText = chainMap[token.chain] || token.chain.toUpperCase();
  const starText = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
  const volumeTag = volUp ? '放量' : '';

  let message = '链上雷达\n';
  message += `链: ${chainText}\n\n`;
  message += `${token.name} (${token.symbol})\n`;
  message += `\`${token.address}\`\n\n`;

  if (descInfo.description) {
    const trimmed =
      descInfo.description.length > 200
        ? `${descInfo.description.slice(0, 200)}...`
        : descInfo.description;
    message += `故事: ${trimmed}\n\n`;
  }

  message += `叙事: ${narrativeTag}\n`;
  message += `连涨${rounds}轮 +${pctGain.toFixed(1)}% ${volumeTag}\n\n`;
  message += '```\n';
  message += `市值     $${token.mc.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(12)}\n`;
  message += `流动性   $${token.liq.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(12)}\n`;
  message += `1h涨幅   ${token.chg_1h >= 0 ? '+' : ''}${token.chg_1h.toFixed(1).padStart(11)}%\n`;
  if (token.sm > 0) {
    message += `聪明钱   ${String(token.sm).padStart(12)}\n`;
  }
  message += `币龄     ${token.age_h.toFixed(1).padStart(10)}h\n`;
  message += '```\n';
  message += `评星: ${starText}  出现次数: ${seenCount}`;

  const links = [];
  if (descInfo.twitter) {
    links.push(`\nTwitter: ${descInfo.twitter}`);
  }
  if (descInfo.telegram) {
    links.push(`TG: ${descInfo.telegram}`);
  }
  if (descInfo.website) {
    links.push(`Web: ${descInfo.website}`);
  }
  if (links.length > 0) {
    message += links.join('\n');
  }

  return message;
}

export function getRadarConfig() {
  return {
    scanInterval: SCAN_INTERVAL,
    minMarketCap: MIN_MARKET_CAP,
    maxMarketCap: MAX_MARKET_CAP,
    minLiquidity: MIN_LIQUIDITY,
    minSmartDegenCount: MIN_SMART_DEGEN_COUNT,
    pushMinLiquidity: PUSH_MIN_LIQUIDITY,
    pushMinHolders: PUSH_MIN_HOLDERS,
    pushMinVolume: PUSH_MIN_VOLUME,
    pushMinBuySellRatio: PUSH_MIN_BUY_SELL_RATIO,
    requireSocials: REQUIRE_SOCIALS,
    momentumConsecutiveUp: MOMENTUM_CONSECUTIVE_UP,
    tradeScoreThreshold: TRADE_SCORE_THRESHOLD,
    tradeMinSmartMoney: TRADE_MIN_SMART_MONEY,
    tradeMaxSignalCount: TRADE_MAX_SIGNAL_COUNT,
    tradeMinLiquidity: TRADE_MIN_LIQUIDITY,
    tradeMinVolume: TRADE_MIN_VOLUME,
    tradeMinBuySellRatio: TRADE_MIN_BUY_SELL_RATIO,
    paperTakeProfitPercent: PAPER_TAKE_PROFIT_PERCENT,
    paperStopLossPercent: PAPER_STOP_LOSS_PERCENT,
    paperBasePositionUsd: PAPER_BASE_POSITION_USD,
    paperTotalCapitalUsd: PAPER_TOTAL_CAPITAL_USD,
    paperMaxOpenPositions: PAPER_MAX_OPEN_POSITIONS,
    paperMaxCapitalUsagePct: PAPER_MAX_CAPITAL_USAGE_PCT,
  };
}

function buildDashboardRows(tokens, alerts) {
  const alertMap = new Map(alerts.map((alert) => [alert.token.address, alert]));

  return tokens
    .map((token) => {
      const [category, matchedKeywords] = classifyNarrative(
        token.name,
        token.symbol,
        token.chain
      );
      const { stars, narrativeTag } = classifyStars(
        token,
        category,
        matchedKeywords || [],
        {}
      );
      const momentum = getMomentumState(token);
      const quality = getPushQualityResult(token, {});
      const signal = alertMap.get(token.address);
      const reasons = [];

      if (momentum.rounds < MOMENTUM_CONSECUTIVE_UP) {
        reasons.push(`动量轮次不足 ${MOMENTUM_CONSECUTIVE_UP}`);
      } else if (!momentum.consecutiveUp) {
        reasons.push('近3轮未连续上涨');
      }

      if (momentum.pctGain < 5) {
        reasons.push('总涨幅低于 5%');
      }

      if ((token.sm || 0) < MIN_SMART_DEGEN_COUNT) {
        reasons.push(`聪明钱低于 ${MIN_SMART_DEGEN_COUNT}`);
      }

      reasons.push(...quality.reasons);

      return {
        address: token.address,
        chain: token.chain,
        name: token.name,
        symbol: token.symbol,
        mc: token.mc,
        liq: token.liq,
        volume: token.volume,
        holders: token.holders,
        smartMoney: token.sm,
        buys1h: token.buys_1h || 0,
        sells1h: token.sells_1h || 0,
        buySellRatio: Number(quality.buySellRatio.toFixed(2)),
        price: token.price,
        ageHours: Number(token.age_h.toFixed(1)),
        change1h: token.chg_1h,
        change24h: token.chg_24h,
        twitter: token.twitter,
        telegram: token.telegram,
        website: token.website,
        stars,
        narrativeTag,
        category,
        matchedKeywords: matchedKeywords || [],
        momentumRounds: momentum.rounds,
        momentumGain: Number(momentum.pctGain.toFixed(2)),
        momentumUp: momentum.consecutiveUp,
        volumeIncreasing: momentum.volIncreasing,
        qualityPass: quality.pass,
        hasSocials: quality.hasSocials,
        signalTriggered: Boolean(signal),
        signalCount: signal ? MOMENTUM_PUSHED.get(token.address)?.count || 1 : 0,
        reasons,
        status: signal
          ? 'triggered'
          : reasons.length === 0
            ? 'ready'
            : momentum.rounds >= 2
              ? 'watching'
              : 'scanning',
      };
    })
    .sort((a, b) => {
      const priority = { triggered: 3, ready: 2, watching: 1, scanning: 0 };
      return (
        priority[b.status] - priority[a.status] ||
        b.momentumGain - a.momentumGain ||
        b.volume - a.volume
      );
    });
}

async function trackMomentum(tokens) {
  const now = Date.now() / 1000;
  const alerts = [];
  const currentAddrs = new Set();

  for (const token of tokens) {
    const address = token.address;
    currentAddrs.add(address);

    if (
      token.mc < MIN_MARKET_CAP ||
      token.liq < MIN_LIQUIDITY ||
      token.mc > MAX_MARKET_CAP
    ) {
      continue;
    }

    const volume = token.volume || 0;
    const price = token.price || 0;
    const buys = token.buys_1h || token.buys || 0;
    const snapshots = MOMENTUM_TRACKER.get(address) || [];

    if (
      snapshots.length > 0 &&
      snapshots[snapshots.length - 1].mc === token.mc &&
      snapshots[snapshots.length - 1].vol === volume
    ) {
      MOMENTUM_TRACKER.set(address, snapshots);
      continue;
    }

    snapshots.push({
      ts: now,
      mc: token.mc,
      vol: volume,
      price,
      buys,
    });

    if (snapshots.length > 20) {
      snapshots.splice(0, snapshots.length - 20);
    }
    MOMENTUM_TRACKER.set(address, snapshots);

    if (snapshots.length < MOMENTUM_CONSECUTIVE_UP) {
      continue;
    }

    const recent = snapshots.slice(-MOMENTUM_CONSECUTIVE_UP);
    let consecutiveUp = true;

    for (let i = 1; i < recent.length; i += 1) {
      const prevMc = recent[i - 1].mc;
      const currMc = recent[i].mc;
      if (prevMc <= 0 || currMc <= prevMc) {
        consecutiveUp = false;
        break;
      }
    }

    if (!consecutiveUp) {
      continue;
    }

    let volIncreasing = true;
    for (let i = 1; i < recent.length; i += 1) {
      if (recent[i].buys < recent[i - 1].buys * 0.8) {
        volIncreasing = false;
        break;
      }
    }

    const firstMc = recent[0].mc;
    const lastMc = recent[recent.length - 1].mc;
    const pctGain = firstMc > 0 ? ((lastMc - firstMc) / firstMc) * 100 : 0;
    if (pctGain < 5) {
      continue;
    }

    if ((token.sm || 0) < MIN_SMART_DEGEN_COUNT) {
      continue;
    }

    const pushInfo = MOMENTUM_PUSHED.get(address) || {
      count: 0,
      lastTs: 0,
      lastMc: 0,
    };

    if (pushInfo.count > 0 && lastMc <= pushInfo.lastMc) {
      continue;
    }

    const safety = await checkTokenSafety(token.chain, address);
    if (!safety.safe) {
      continue;
    }

    const [category, matchedKeywords] = classifyNarrative(
      token.name,
      token.symbol,
      token.chain
    );
    const descInfo = await fetchTokenDescription(token.chain, address);
    if (!passesPushQualityGate(token, descInfo)) {
      continue;
    }
    const { stars, narrativeTag } = classifyStars(
      token,
      category,
      matchedKeywords || [],
      descInfo
    );

    pushInfo.count += 1;
    pushInfo.lastTs = now;
    pushInfo.lastMc = lastMc;
    MOMENTUM_PUSHED.set(address, pushInfo);

    const message = formatMomentumAlert(
      token,
      pctGain,
      recent.length,
      volIncreasing,
      stars,
      narrativeTag,
      descInfo,
      pushInfo.count
    );

    alerts.push({
      msg: message,
      token,
      pctGain,
      descInfo,
      stars,
      narrativeTag,
      category,
      matchedKeywords: matchedKeywords || [],
      signalCount: pushInfo.count,
    });
    log(
      `[动量信号${pushInfo.count}] ${token.name} (${token.symbol}) on ${token.chain} — 连涨${recent.length}轮 +${pctGain.toFixed(1)}%`
    );
  }

  for (const [address, snapshots] of MOMENTUM_TRACKER.entries()) {
    if (!currentAddrs.has(address) && now - snapshots[snapshots.length - 1].ts > 600) {
      MOMENTUM_TRACKER.delete(address);
    }
  }

  for (const [address, info] of MOMENTUM_PUSHED.entries()) {
    if (now - info.lastTs > 3600) {
      MOMENTUM_PUSHED.delete(address);
    }
  }

  alerts.sort((a, b) => b.pctGain - a.pctGain);
  return alerts;
}

export async function scanNarratives(options = {}) {
  const { deliver = true, rowLimit = 60 } = options;
  const db = initDb();
  ensureStrategySessionMeta(db);
  const tokens = await fetchNewTokens();
  const scannedAt = new Date().toISOString();
  const scannedAtTs = Math.floor(Date.now() / 1000);
  log(`扫描 ${tokens.length} 个候选币...`);

  const allMomentumTokens = [...tokens];
  const momentumAlerts = await trackMomentum(allMomentumTokens);
  const dashboardRows = buildDashboardRows(tokens, momentumAlerts).slice(0, rowLimit);

  for (const token of tokens) {
    if (isTokenSeen(db, token.address)) {
      db.prepare(`
        UPDATE tokens_seen
        SET seen_count = seen_count + 1, market_cap = ?
        WHERE address = ?
      `).run(token.mc, token.address);

      const theme = normalizeTheme(token.name, token.symbol);
      if (theme) {
        db.prepare(`
          UPDATE narratives
          SET token_count = token_count + 1, last_seen_at = ?
          WHERE theme = ?
        `).run(Math.floor(Date.now() / 1000), theme);
      }

      continue;
    }

    const [category] = classifyNarrative(token.name, token.symbol, token.chain);
    if (category === 'spam') {
      recordToken(db, token.address, token.chain, token.name, token.symbol, '', 'spam', token.mc);
      continue;
    }

    if (token.mc < MIN_MARKET_CAP || token.liq < MIN_LIQUIDITY) {
      recordToken(
        db,
        token.address,
        token.chain,
        token.name,
        token.symbol,
        '',
        'too_small',
        token.mc
      );
      continue;
    }

    const theme = normalizeTheme(token.name, token.symbol);
    recordToken(
      db,
      token.address,
      token.chain,
      token.name,
      token.symbol,
      theme,
      category,
      token.mc
    );
    checkNarrativeNovelty(db, theme, token.name, token.address, token.chain);
  }

  setRadarMeta(db, 'last_scanned_at', scannedAt);
  setRadarMeta(db, 'last_scanned_at_ts', scannedAtTs);

  const currentAlerts = momentumAlerts.slice(0, MAX_ALERTS_PER_ROUND);
  processTradePlans(db, currentAlerts, tokens, scannedAtTs);
  const persistedThisRound = persistAlerts(db, currentAlerts, scannedAtTs);
  const persistedAlerts = getRecentPersistedAlerts(db, rowLimit);
  const totalPersisted =
    db.prepare('SELECT COUNT(*) AS count FROM pushed_alerts').get().count || 0;
  const totalPersistedTokens =
    db.prepare("SELECT COUNT(DISTINCT chain || ':' || address) AS count FROM pushed_alerts").get()
      .count || 0;
  const lastScannedAt = getRadarMeta(db, 'last_scanned_at', scannedAt);
  const paperSummary = getPaperTradeSummary(db);
  const paperPositions = getPaperPositions(db, 'open', 20);
  const closedPaperPositions = getPaperPositions(db, 'closed', 30);

  let pushed = 0;
  if (deliver) {
    for (const alert of currentAlerts) {
      if (await tgSend(alert.msg)) {
        pushed += 1;
        await sleep(1_000);
      }
    }
  }

  db.close();
  return {
    pushed,
    found: currentAlerts.length,
    scanned: tokens.length,
    scannedAt: lastScannedAt,
    persistedThisRound,
    totalPersisted,
    totalPersistedTokens,
    paperSummary,
    paperPositions,
    closedPaperPositions,
    summary: {
      triggered: dashboardRows.filter((row) => row.status === 'triggered').length,
      ready: dashboardRows.filter((row) => row.status === 'ready').length,
      watching: dashboardRows.filter((row) => row.status === 'watching').length,
      scanning: dashboardRows.filter((row) => row.status === 'scanning').length,
    },
    alerts: persistedAlerts,
    rows: dashboardRows,
    config: getRadarConfig(),
  };
}

async function main() {
  const db = initDb();
  ensureStrategySessionMeta(db, { reset: true });
  db.close();

  log('='.repeat(50));
  log('链上雷达 Node.js 版启动');
  log(`扫描间隔: ${SCAN_INTERVAL}s`);
  log('推送逻辑: 动量优先 — 连涨才推，叙事只做分类标签');
  log(
    `核心规则: 30秒仅扫描SOL，连涨3轮且涨幅>=5%，聪明钱>=${MIN_SMART_DEGEN_COUNT}，流动性>=${PUSH_MIN_LIQUIDITY}，持有人>=${PUSH_MIN_HOLDERS}，1h量>=${PUSH_MIN_VOLUME}，买卖比>=${PUSH_MIN_BUY_SELL_RATIO}`
  );
  log(
    `交易风控: score>=${TRADE_SCORE_THRESHOLD}，仅第1次信号，最多${PAPER_MAX_OPEN_POSITIONS}个持仓，资金使用率<=${PAPER_MAX_CAPITAL_USAGE_PCT}%，基础仓位${PAPER_BASE_POSITION_USD} USD，TP +${PAPER_TAKE_PROFIT_PERCENT}% / SL -${PAPER_STOP_LOSS_PERCENT}%`
  );
  log('='.repeat(50));

  await tgSend(
    '链上雷达 Node.js 版已启动\n\n' +
      '核心逻辑: 动量优先\n' +
      `连涨3轮+涨幅>=5%且聪明钱>=${MIN_SMART_DEGEN_COUNT}才推送\n` +
      '扫描范围: 仅SOL\n' +
      `质量门槛: 流动性>=${PUSH_MIN_LIQUIDITY} | 持有人>=${PUSH_MIN_HOLDERS} | 1h量>=${PUSH_MIN_VOLUME} | 买卖比>=${PUSH_MIN_BUY_SELL_RATIO}\n` +
      `交易风控: score>=${TRADE_SCORE_THRESHOLD} | 仅第1次信号 | 最多${PAPER_MAX_OPEN_POSITIONS}仓 | 资金使用率<=${PAPER_MAX_CAPITAL_USAGE_PCT}% | 基础仓位${PAPER_BASE_POSITION_USD} USD | TP +${PAPER_TAKE_PROFIT_PERCENT}% | SL -${PAPER_STOP_LOSS_PERCENT}%\n` +
      `社交要求: ${REQUIRE_SOCIALS ? '至少有1个社交/官网链接' : '关闭'}\n` +
      '叙事只做分类标签:\n' +
      '★★★ 马斯克/川普\n' +
      '★★ 名人热点 | 有叙事\n' +
      '★ 无明确叙事\n\n' +
      `扫描频率: 每${SCAN_INTERVAL}秒`
  );

  if (process.argv.includes('--once')) {
    const result = await scanNarratives({ deliver: true });
    log(`单轮扫描完成: 发现${result.found}个信号, 推送${result.pushed}个`);
    return;
  }

  let scanCount = 0;
  let totalPushed = 0;

  while (true) {
    try {
      scanCount += 1;
      const result = await scanNarratives({ deliver: true });
      totalPushed += result.pushed;

      if (result.pushed > 0) {
        log(
          `第${scanCount}轮: 发现${result.found}个, 推送${result.pushed}个 (累计推送${totalPushed})`
        );
      } else if (scanCount % 20 === 0) {
        log(`第${scanCount}轮: 无新信号 (累计推送${totalPushed})`);
      }
    } catch (error) {
      log(`扫描异常: ${error.message}`);
    }

    await sleep(SCAN_INTERVAL * 1000);
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFilePath === entryFilePath) {
  main().catch((error) => {
    log(`启动失败: ${error.message}`);
    process.exit(1);
  });
}
