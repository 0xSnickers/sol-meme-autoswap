import './lib/signal-env.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { addBn, divBn, mulBn, roundBn, subBn, sumBn } from './lib/bignumber-utils.js';
import {
  getSupabaseAlertStats,
  getSupabasePaperTradeSettings,
  getSupabasePaperTradeSummary,
  getSupabasePaperPositions,
  getSupabasePersistedSignalSnapshot,
  getSupabasePersistedAlerts,
  getSupabaseSignalTimeline,
  loadSupabaseRuntimeState,
  supabaseStorageEnabled,
  syncSupabaseSignalSnapshot,
  updateSupabasePaperTradeSettings,
} from './lib/signal-supabase-store.js';

dotenv.config({
  path: path.join(os.homedir(), '.env'),
  override: false,
  quiet: true,
});
dotenv.config({ override: false, quiet: true });

const require = createRequire(import.meta.url);
const DEFAULT_DATA_DIR = path.join(process.cwd(), '.signal-scan-data');
let DATA_DIR = process.env.RADAR_DATA_DIR || DEFAULT_DATA_DIR;
const FILE_LOGGING_ENABLED = String(
  process.env.RADAR_FILE_LOG_ENABLED || (supabaseStorageEnabled() ? 'false' : 'true')
).toLowerCase() !== 'false';
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
// Recent strong winners often peak in the mid-60 score range on their first trigger.
const TRADE_SCORE_THRESHOLD = Number(process.env.RADAR_TRADE_SCORE_THRESHOLD || 64);
const TRADE_MIN_SMART_MONEY = Number(process.env.RADAR_TRADE_MIN_SMART_MONEY || 3);
const TRADE_HEAD_ENTRY_SIGNAL_COUNT = 1;
const TRADE_SECOND_HEAD_ENTRY_SIGNAL_COUNT = 2;
const TRADE_MAX_SIGNAL_COUNT = Number(process.env.RADAR_TRADE_MAX_SIGNAL_COUNT || 3);
const TRADE_MIN_LIQUIDITY = Number(process.env.RADAR_TRADE_MIN_LIQUIDITY || 15_000);
const TRADE_MIN_VOLUME = Number(process.env.RADAR_TRADE_MIN_VOLUME || 30_000);
const TRADE_MIN_BUY_SELL_RATIO = Number(process.env.RADAR_TRADE_MIN_BUY_SELL_RATIO || 1.4);
const TRADE_MAX_TOKEN_AGE_HOURS = Number(process.env.RADAR_TRADE_MAX_TOKEN_AGE_HOURS || 48);
const TRADE_HOT_MODE_CHANGE_1H = Number(process.env.RADAR_TRADE_HOT_MODE_CHANGE_1H || 50);
const TRADE_HOT_MODE_MIN_SMART_MONEY = Number(
  process.env.RADAR_TRADE_HOT_MODE_MIN_SMART_MONEY || 5
);
const TRADE_HOT_MODE_MIN_LIQUIDITY = Number(
  process.env.RADAR_TRADE_HOT_MODE_MIN_LIQUIDITY || 30_000
);
const TRADE_HOT_MODE_MIN_BUY_SELL_RATIO = Number(
  process.env.RADAR_TRADE_HOT_MODE_MIN_BUY_SELL_RATIO || 1.6
);
const TRADE_HOT_MODE_MIN_SCORE = Number(process.env.RADAR_TRADE_HOT_MODE_MIN_SCORE || 68);
const TRADE_SCORE_AVG_LOOKBACK = 3;
const TRADE_SECOND_HEAD_MIN_SCORE_DELTA = Number(process.env.RADAR_TRADE_SECOND_HEAD_MIN_SCORE_DELTA || 5);
const TRADE_SECOND_HEAD_MIN_SCORE = Number(
  process.env.RADAR_TRADE_SECOND_HEAD_MIN_SCORE || Math.max(TRADE_SCORE_THRESHOLD + 4, 68)
);
const LEGACY_PAPER_TAKE_PROFIT_PERCENT = Number(process.env.RADAR_PAPER_TP_PERCENT || 50);
const DEFAULT_PAPER_STOP_LOSS_PERCENT = Number(process.env.RADAR_PAPER_SL_PERCENT || 50);
const MAX_PAPER_STOP_LOSS_PERCENT = Number(process.env.RADAR_PAPER_MAX_SL_PERCENT || 80);
const DEFAULT_PAPER_TRAILING_START_PERCENT = Number(
  process.env.RADAR_PAPER_TRAILING_START_PERCENT || 180
);
const DEFAULT_PAPER_TRAILING_STOP_PERCENT = Number(
  process.env.RADAR_PAPER_TRAILING_STOP_PERCENT || 35
);
const DEFAULT_PAPER_TIME_STOP_HOURS = Number(process.env.RADAR_PAPER_TIME_STOP_HOURS || 8);
const DEFAULT_PAPER_TAKE_PROFIT_STEPS = normalizeTakeProfitSteps(
  parseTakeProfitStepsFromEnv(process.env.RADAR_PAPER_TP_STEPS) || buildLegacyTakeProfitStepsFromEnv()
);
const PAPER_BASE_POSITION_USD = Number(process.env.RADAR_PAPER_BASE_POSITION_USD || 40);
const PAPER_TOTAL_CAPITAL_USD = Number(process.env.RADAR_PAPER_TOTAL_CAPITAL_USD || 1_000);
const PAPER_MAX_OPEN_POSITIONS = Number(process.env.RADAR_PAPER_MAX_OPEN_POSITIONS || 4);
const PAPER_MAX_CAPITAL_USAGE_PCT = Number(
  process.env.RADAR_PAPER_MAX_CAPITAL_USAGE_PCT || 25
);
const PAPER_MAX_SINGLE_POSITION_PCT = Number(
  process.env.RADAR_PAPER_MAX_SINGLE_POSITION_PCT || 10
);
const PAPER_ENTRY_STAGE_ALLOCATIONS = [1];

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
const TOKENS_SEEN_RUNTIME = new Map();
const NARRATIVES_RUNTIME = new Map();
let SqliteDatabase = null;

function getSqliteDatabase() {
  if (SqliteDatabase) {
    return SqliteDatabase;
  }

  try {
    SqliteDatabase = require('better-sqlite3');
    return SqliteDatabase;
  } catch (error) {
    throw new Error(
      `当前运行路径需要 SQLite，但未能加载 better-sqlite3: ${error.message}`
    );
  }
}

function roundTo(value, digits = 2) {
  return roundBn(value || 0, digits);
}

function normalizeTakeProfitSteps(steps = []) {
  const normalized = steps
    .map((step) => ({
      targetPercent: Number(step?.targetPercent ?? step?.pct ?? 0),
      sellPercent: Number(step?.sellPercent ?? step?.portion ?? 0),
    }))
    .filter((step) => Number.isFinite(step.targetPercent) && Number.isFinite(step.sellPercent))
    .map((step) => ({
      targetPercent: Math.max(1, roundTo(step.targetPercent, 2)),
      sellPercent: Math.max(1, Math.min(100, roundTo(step.sellPercent, 2))),
    }))
    .sort((left, right) => left.targetPercent - right.targetPercent);

  if (!normalized.length) {
    return [
      { targetPercent: 25, sellPercent: 55 },
      { targetPercent: 60, sellPercent: 25 },
      { targetPercent: 120, sellPercent: 20 },
    ];
  }

  let runningSellPercent = 0;
  return normalized
    .map((step) => {
      const remaining = Math.max(0, 100 - runningSellPercent);
      if (remaining <= 0) {
        return null;
      }
      const cappedSellPercent = Math.max(1, Math.min(step.sellPercent, remaining));
      runningSellPercent += cappedSellPercent;
      return {
        targetPercent: step.targetPercent,
        sellPercent: cappedSellPercent,
      };
    })
    .filter(Boolean);
}

function parseTakeProfitStepsFromEnv(raw = '') {
  const source = String(raw || '').trim();
  if (!source) {
    return null;
  }

  const parsed = source
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [targetText, sellText] = chunk.split(':').map((part) => part.trim());
      const targetPercent = Number(targetText);
      const sellPercent = Number(sellText);
      if (!Number.isFinite(targetPercent) || !Number.isFinite(sellPercent)) {
        return null;
      }
      return { targetPercent, sellPercent };
    })
    .filter(Boolean);

  return parsed.length > 0 ? parsed : null;
}

function buildLegacyTakeProfitStepsFromEnv() {
  const hasLegacyConfig =
    process.env.RADAR_PAPER_TP1_PERCENT ||
    process.env.RADAR_PAPER_TP1_SELL_PERCENT ||
    process.env.RADAR_PAPER_TP2_PERCENT ||
    process.env.RADAR_PAPER_TP2_SELL_PERCENT ||
    process.env.RADAR_PAPER_TP3_PERCENT ||
    process.env.RADAR_PAPER_TP3_SELL_PERCENT ||
    process.env.RADAR_PAPER_TP_PERCENT;

  if (!hasLegacyConfig) {
    return [
      { targetPercent: 80, sellPercent: 55 },
      { targetPercent: 150, sellPercent: 25 },
      { targetPercent: 260, sellPercent: 20 },
    ];
  }

  const steps = [
    {
      targetPercent: Number(process.env.RADAR_PAPER_TP1_PERCENT || 80),
      sellPercent: Number(process.env.RADAR_PAPER_TP1_SELL_PERCENT || 55),
    },
    {
      targetPercent: Number(process.env.RADAR_PAPER_TP2_PERCENT || 150),
      sellPercent: Number(process.env.RADAR_PAPER_TP2_SELL_PERCENT || 25),
    },
  ];

  if (process.env.RADAR_PAPER_TP3_PERCENT || process.env.RADAR_PAPER_TP3_SELL_PERCENT) {
    steps.push({
      targetPercent: Number(process.env.RADAR_PAPER_TP3_PERCENT || 260),
      sellPercent: Number(process.env.RADAR_PAPER_TP3_SELL_PERCENT || 20),
    });
  }

  return steps;
}

function normalizePaperTradeSettings(input = {}) {
  const fallback = {
    stopLossPercent: DEFAULT_PAPER_STOP_LOSS_PERCENT,
    takeProfitSteps: DEFAULT_PAPER_TAKE_PROFIT_STEPS,
    trailingStartPercent: DEFAULT_PAPER_TRAILING_START_PERCENT,
    trailingStopPercent: DEFAULT_PAPER_TRAILING_STOP_PERCENT,
    timeStopHours: DEFAULT_PAPER_TIME_STOP_HOURS,
  };

  const stopLossPercent = Number(input.stopLossPercent ?? fallback.stopLossPercent);
  const trailingStartPercent = Number(
    input.trailingStartPercent ?? fallback.trailingStartPercent
  );
  const trailingStopPercent = Number(
    input.trailingStopPercent ?? fallback.trailingStopPercent
  );
  const timeStopHours = Number(input.timeStopHours ?? fallback.timeStopHours);

  return {
    stopLossPercent: Number.isFinite(stopLossPercent)
      ? Math.max(5, Math.min(MAX_PAPER_STOP_LOSS_PERCENT, roundTo(stopLossPercent, 2)))
      : fallback.stopLossPercent,
    takeProfitSteps: normalizeTakeProfitSteps(input.takeProfitSteps || fallback.takeProfitSteps),
    trailingStartPercent: Number.isFinite(trailingStartPercent)
      ? Math.max(10, Math.min(300, roundTo(trailingStartPercent, 2)))
      : fallback.trailingStartPercent,
    trailingStopPercent: Number.isFinite(trailingStopPercent)
      ? Math.max(5, Math.min(80, roundTo(trailingStopPercent, 2)))
      : fallback.trailingStopPercent,
    timeStopHours: Number.isFinite(timeStopHours)
      ? Math.max(1, Math.min(168, roundTo(timeStopHours, 2)))
      : fallback.timeStopHours,
  };
}

function formatTakeProfitStepsLabel(steps = []) {
  return steps.map((step) => `+${step.targetPercent}%/${step.sellPercent}%`).join(' · ');
}

function formatPaperTradePolicyLabel(settings = {}) {
  const normalized = normalizePaperTradeSettings(settings);
  return [
    `分批止盈 ${formatTakeProfitStepsLabel(normalized.takeProfitSteps)}`,
    `止损 -${normalized.stopLossPercent}%`,
    `${normalized.timeStopHours}h 未到 TP1 全平`,
    `+${normalized.trailingStartPercent}% 启动 trailing / 回撤 ${normalized.trailingStopPercent}%`,
  ].join(' | ');
}

function formatCompactPrice(price) {
  const value = Number(price || 0);
  if (value <= 0) {
    return '--';
  }
  if (value >= 1) {
    return value.toFixed(4);
  }
  if (value >= 0.01) {
    return value.toFixed(6);
  }
  return value.toFixed(8);
}

function compareSignalPriority(left, right) {
  if ((right?.token?.sm || 0) !== (left?.token?.sm || 0)) {
    return (right?.token?.sm || 0) - (left?.token?.sm || 0);
  }
  if ((right?.signalCount || 0) !== (left?.signalCount || 0)) {
    return (right?.signalCount || 0) - (left?.signalCount || 0);
  }
  if ((right?.pctGain || 0) !== (left?.pctGain || 0)) {
    return (right?.pctGain || 0) - (left?.pctGain || 0);
  }
  return String(left?.token?.address || '').localeCompare(String(right?.token?.address || ''));
}

function getGmgnTokenUrl(chain, address) {
  const gmgnChainMap = {
    sol: 'sol',
    eth: 'eth',
    bsc: 'bsc',
    base: 'base',
  };

  return `https://gmgn.ai/${gmgnChainMap[chain] || 'sol'}/token/${address}`;
}

function getPriceActionScore(token, pctGain, rounds, volUp) {
  let score = 0;
  const smartMoney = Number(token.sm || 0);
  const volume = Number(token.volume || 0);
  const liquidity = Number(token.liq || 0);
  const oneHourChange = Number(token.chg_1h || 0);
  const buySellRatio = Number(getBuySellMetrics(token).buySellRatio || 0);

  if (rounds >= 3) {
    score += 20;
  } else if (rounds >= 2) {
    score += 10;
  }

  if (pctGain >= 30) {
    score += 25;
  } else if (pctGain >= 15) {
    score += 18;
  } else if (pctGain >= 8) {
    score += 12;
  } else if (pctGain >= 5) {
    score += 8;
  }

  if (volUp) {
    score += 10;
  }

  if (smartMoney >= 5) {
    score += 15;
  } else if (smartMoney >= 3) {
    score += 10;
  } else if (smartMoney >= 2) {
    score += 6;
  }

  if (buySellRatio >= 1.5) {
    score += 12;
  } else if (buySellRatio >= 1.2) {
    score += 8;
  } else if (buySellRatio >= 1.1) {
    score += 5;
  }

  if (volume >= 100_000) {
    score += 10;
  } else if (volume >= 30_000) {
    score += 6;
  }

  if (liquidity >= 20_000) {
    score += 8;
  } else if (liquidity >= 10_000) {
    score += 5;
  }

  if (oneHourChange >= 80) {
    score -= 15;
  } else if (oneHourChange >= 50) {
    score -= 8;
  }

  const finalScore = Math.max(0, Math.min(100, roundTo(score, 0)));
  let label = '观察';
  if (finalScore >= 80) {
    label = '强势';
  } else if (finalScore >= 65) {
    label = '偏强';
  } else if (finalScore >= 50) {
    label = '中性';
  }

  return {
    score: finalScore,
    label,
  };
}

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
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${message}`;
  console.log(line);
  if (!FILE_LOGGING_ENABLED) {
    return;
  }

  ensureDataDir();
  fs.appendFileSync(path.join(DATA_DIR, 'signal_scan.log'), `${line}\n`);
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

function initDb(options = {}) {
  const { inMemory = false } = options;
  if (!inMemory) {
    ensureDataDir();
  }
  const Database = getSqliteDatabase();
  const db = new Database(inMemory ? ':memory:' : path.join(DATA_DIR, 'narrative_history.db'));
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
      image_url TEXT,
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
      image_url TEXT,
      entry_signal_count INTEGER NOT NULL,
      trade_score INTEGER,
      position_size_usd REAL,
      target_position_size_usd REAL,
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
      entry_stage INTEGER DEFAULT 3,
      peak_price REAL,
      peak_pnl_pct REAL DEFAULT 0,
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
  if (!columnNames.has('image_url')) {
    db.exec('ALTER TABLE pushed_alerts ADD COLUMN image_url TEXT');
  }
  if (!columnNames.has('price')) {
    db.exec('ALTER TABLE pushed_alerts ADD COLUMN price REAL');
  }

  const positionColumns = db.prepare('PRAGMA table_info(paper_positions)').all();
  const positionColumnNames = new Set(positionColumns.map((column) => column.name));
  if (!positionColumnNames.has('image_url')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN image_url TEXT');
  }
  if (!positionColumnNames.has('position_size_usd')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN position_size_usd REAL');
  }
  if (!positionColumnNames.has('token_amount')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN token_amount REAL');
  }
  if (!positionColumnNames.has('target_position_size_usd')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN target_position_size_usd REAL');
  }
  if (!positionColumnNames.has('remaining_token_amount')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN remaining_token_amount REAL');
  }
  if (!positionColumnNames.has('remaining_position_size_usd')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN remaining_position_size_usd REAL');
  }
  if (!positionColumnNames.has('realized_pnl_usd')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN realized_pnl_usd REAL DEFAULT 0');
  }
  if (!positionColumnNames.has('realized_proceeds_usd')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN realized_proceeds_usd REAL DEFAULT 0');
  }
  if (!positionColumnNames.has('tp_stage')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN tp_stage INTEGER DEFAULT 0');
  }
  if (!positionColumnNames.has('tp_plan_json')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN tp_plan_json TEXT');
  }
  if (!positionColumnNames.has('peak_price')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN peak_price REAL');
  }
  if (!positionColumnNames.has('entry_stage')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN entry_stage INTEGER DEFAULT 3');
  }
  if (!positionColumnNames.has('peak_pnl_pct')) {
    db.exec('ALTER TABLE paper_positions ADD COLUMN peak_pnl_pct REAL DEFAULT 0');
  }

  backfillPaperPositionState(db);

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

function getPaperTradeSettings(db) {
  const raw = getRadarMeta(db, 'paper_trade_settings', null);
  if (!raw) {
    return normalizePaperTradeSettings();
  }

  try {
    return normalizePaperTradeSettings(JSON.parse(raw));
  } catch {
    return normalizePaperTradeSettings();
  }
}

function setPaperTradeSettings(db, settings) {
  const normalized = normalizePaperTradeSettings(settings);
  setRadarMeta(db, 'paper_trade_settings', JSON.stringify(normalized));
  return normalized;
}

function getPositionTakeProfitSteps(position, fallbackSettings = null) {
  if (position?.tp_plan_json) {
    try {
      return normalizeTakeProfitSteps(JSON.parse(position.tp_plan_json));
    } catch {
      // Ignore invalid persisted steps and fall back to current settings.
    }
  }

  return normalizeTakeProfitSteps(fallbackSettings?.takeProfitSteps || DEFAULT_PAPER_TAKE_PROFIT_STEPS);
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

function backfillPaperPositionState(db) {
  const settings = getPaperTradeSettings(db);
  const rows = db
    .prepare(
      `SELECT id, smart_money, trade_score, entry_price, position_size_usd, target_position_size_usd,
              entry_stage, token_amount,
              remaining_token_amount, remaining_position_size_usd, realized_pnl_usd,
              realized_proceeds_usd, tp_stage, tp_plan_json, peak_price, peak_pnl_pct
       FROM paper_positions
       WHERE entry_price > 0`
    )
    .all();

  const stmt = db.prepare(`
    UPDATE paper_positions
    SET position_size_usd = ?, target_position_size_usd = ?, token_amount = ?, remaining_token_amount = ?,
        remaining_position_size_usd = ?, realized_pnl_usd = ?, realized_proceeds_usd = ?,
        tp_stage = ?, tp_plan_json = ?, entry_stage = ?, peak_price = ?, peak_pnl_pct = ?
    WHERE id = ?
  `);

  for (const row of rows) {
    const sizing = getPaperPositionSizingByMetrics(
      row.smart_money || 0,
      row.trade_score || 0,
      row.entry_price || 0
    );
    const positionSizeUsd = Number(row.position_size_usd || sizing.positionSizeUsd || 0);
    const tokenAmount = Number(row.token_amount || sizing.tokenAmount || 0);
    const remainingTokenAmount = Number(row.remaining_token_amount || tokenAmount || 0);
    const remainingPositionSizeUsd = Number(
      row.remaining_position_size_usd || positionSizeUsd || 0
    );
    const targetPositionSizeUsd = Number(row.target_position_size_usd || positionSizeUsd || 0);
    const realizedPnlUsd = Number(row.realized_pnl_usd || 0);
    const realizedProceedsUsd = Number(row.realized_proceeds_usd || 0);
    const tpStage = Number(row.tp_stage || 0);
    const tpPlanJson =
      row.tp_plan_json || JSON.stringify(normalizeTakeProfitSteps(settings.takeProfitSteps));
    const entryStage = Math.max(
      1,
      Math.min(
        PAPER_ENTRY_STAGE_ALLOCATIONS.length,
        Number(row.entry_stage || PAPER_ENTRY_STAGE_ALLOCATIONS.length)
      )
    );
    const peakPrice = Number(row.peak_price || row.entry_price || 0);
    const peakPnlPct = Number(row.peak_pnl_pct || 0);

    stmt.run(
      positionSizeUsd,
      targetPositionSizeUsd,
      tokenAmount,
      remainingTokenAmount,
      remainingPositionSizeUsd,
      realizedPnlUsd,
      realizedProceedsUsd,
      tpStage,
      tpPlanJson,
      entryStage,
      peakPrice,
      peakPnlPct,
      row.id
    );
  }
}

function toAlertRecord(alert, pushedAt) {
  return {
    chain: alert.token.chain,
    address: alert.token.address,
    signalCount: alert.signalCount || 1,
    name: alert.token.name,
    symbol: alert.token.symbol,
    imageUrl: alert.token.imageUrl || '',
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
      chain, address, signal_count, name, symbol, image_url, price, mc, liq, volume,
      smart_money, holders, buy_sell_ratio, age_hours, change_1h,
      pct_gain, stars, narrative_tag, category, twitter, telegram,
      website, message, pushed_at
    ) VALUES (
      @chain, @address, @signalCount, @name, @symbol, @imageUrl, @price, @mc, @liq, @volume,
      @smartMoney, @holders, @buySellRatio, @ageHours, @change1h,
      @pctGain, @stars, @narrativeTag, @category, @twitter, @telegram,
      @website, @message, @pushedAt
    )
  `);

  let inserted = 0;
  alerts.forEach((alert, index) => {
    const result = insert.run(toAlertRecord(alert, pushedAt + index));
    inserted += result.changes;
  });
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
      ageHours: token.age_h || 0,
      pctGain: input.pctGain || 0,
      buySellRatio: Number(getBuySellMetrics(token).buySellRatio.toFixed(2)),
    };
  }

  return {
    signalCount: input.signalCount || 1,
    sm: input.smartMoney || 0,
    liq: input.liq || 0,
    volume: input.volume || 0,
    chg_1h: input.change1h || 0,
    ageHours: input.ageHours || 0,
    pctGain: input.pctGain || 0,
    buySellRatio: Number((input.buySellRatio || 0).toFixed(2)),
  };
}

function getTradeScore(alert) {
  const candidate = normalizeTradeCandidate(alert);
  const parts = [];
  let score = 0;

  if (candidate.sm >= 15) {
    score += 30;
    parts.push('聪明钱>=15 +30');
  } else if (candidate.sm >= 8) {
    score += 22;
    parts.push('聪明钱8-14 +22');
  } else if (candidate.sm >= 5) {
    score += 14;
    parts.push('聪明钱5-7 +14');
  } else if (candidate.sm >= 3) {
    score += 8;
    parts.push('聪明钱3-4 +8');
  } else if (candidate.sm >= 2) {
    score += 4;
    parts.push('聪明钱=2 +4');
  }

  if (candidate.signalCount <= 1) {
    score += 10;
    parts.push('第1次信号 +10');
  } else if (candidate.signalCount === 2) {
    score += 6;
    parts.push('第2次信号 +6');
  } else if (candidate.signalCount === 3) {
    score += 2;
    parts.push('第3次信号 +2');
  } else {
    score -= 6;
    parts.push('第4次及以上 -6');
  }

  if (candidate.pctGain >= 15) {
    score += 15;
    parts.push('扫描窗口涨幅>=15% +15');
  } else if (candidate.pctGain >= 10) {
    score += 12;
    parts.push('扫描窗口涨幅>=10% +12');
  } else if (candidate.pctGain >= 8) {
    score += 8;
    parts.push('扫描窗口涨幅>=8% +8');
  } else if (candidate.pctGain >= 5) {
    score += 5;
    parts.push('扫描窗口涨幅>=5% +5');
  }

  if (candidate.liq >= 100_000) {
    score += 16;
    parts.push('流动性>=100000 +16');
  } else if (candidate.liq >= 50_000) {
    score += 12;
    parts.push('流动性>=50000 +12');
  } else if (candidate.liq >= 20_000) {
    score += 10;
    parts.push('流动性>=20000 +10');
  } else if (candidate.liq >= 10_000) {
    score += 6;
    parts.push('流动性>=10000 +6');
  } else if (candidate.liq >= 5_000) {
    score += 2;
    parts.push('流动性>=5000 +2');
  }

  if (candidate.volume >= 500_000) {
    score += 16;
    parts.push('1h量>=500000 +16');
  } else if (candidate.volume >= 200_000) {
    score += 12;
    parts.push('1h量>=200000 +12');
  } else if (candidate.volume >= 100_000) {
    score += 10;
    parts.push('1h量>=100000 +10');
  } else if (candidate.volume >= 50_000) {
    score += 7;
    parts.push('1h量>=50000 +7');
  } else if (candidate.volume >= 30_000) {
    score += 4;
    parts.push('1h量>=30000 +4');
  }

  if (candidate.buySellRatio >= 2) {
    score += 12;
    parts.push('买卖比>=2.0 +12');
  } else if (candidate.buySellRatio >= 1.8) {
    score += 9;
    parts.push('买卖比>=1.8 +9');
  } else if (candidate.buySellRatio >= 1.6) {
    score += 6;
    parts.push('买卖比>=1.6 +6');
  } else if (candidate.buySellRatio >= 1.4) {
    score += 3;
    parts.push('买卖比>=1.4 +3');
  } else if (candidate.buySellRatio < 1.2) {
    score -= 6;
    parts.push('买卖比<1.2 -6');
  } else if (candidate.buySellRatio < 1.4) {
    score -= 2;
    parts.push('买卖比<1.4 -2');
  }

  if (candidate.ageHours <= 6) {
    score += 5;
    parts.push('币龄<=6h +5');
  } else if (candidate.ageHours <= 12) {
    score += 4;
    parts.push('币龄<=12h +4');
  } else if (candidate.ageHours <= 24) {
    score += 3;
    parts.push('币龄<=24h +3');
  } else if (candidate.ageHours <= TRADE_MAX_TOKEN_AGE_HOURS) {
    score += 1;
    parts.push(`币龄<=${TRADE_MAX_TOKEN_AGE_HOURS}h +1`);
  }

  if (candidate.chg_1h >= 80) {
    score -= 18;
    parts.push('1h涨幅>=80% -18');
  } else if (candidate.chg_1h >= 50) {
    score -= 10;
    parts.push('1h涨幅>=50% -10');
  } else if (candidate.chg_1h >= 30) {
    score -= 4;
    parts.push('1h涨幅>=30% -4');
  }

  return {
    score: Math.max(0, roundTo(score, 0)),
    parts,
    buySellRatio: candidate.buySellRatio,
  };
}

function getTradeScoreHistoryFromAlert(alert) {
  const rawHistory = Array.isArray(alert?.signalHistory) ? alert.signalHistory : [];
  const expectedPreviousCount = Math.max(0, Number(alert?.signalCount || 0) - 1);
  const scores = rawHistory
    .map((entry) => Number(entry?.tradeScore))
    .filter((score) => Number.isFinite(score));

  if (expectedPreviousCount <= 0) {
    return [];
  }
  if (scores.length >= expectedPreviousCount) {
    return scores.slice(0, expectedPreviousCount);
  }
  return scores;
}

function getTradeScoreStats(currentScore, historyScores = []) {
  const previousScores = historyScores
    .map((score) => Number(score))
    .filter((score) => Number.isFinite(score))
    .slice(-(TRADE_SCORE_AVG_LOOKBACK - 1));
  const recentScores = [...previousScores, Number(currentScore || 0)].slice(-TRADE_SCORE_AVG_LOOKBACK);
  const scoreTotal = recentScores.reduce((sum, score) => sum + score, 0);
  const averageScore = recentScores.length > 0 ? roundTo(scoreTotal / recentScores.length, 1) : 0;
  const previousScore =
    recentScores.length > 1 ? recentScores[recentScores.length - 2] : Number(currentScore || 0);
  const trendDelta = roundTo(Number(currentScore || 0) - previousScore, 1);

  return {
    recentScores,
    averageScore,
    trendDelta,
    previousScore,
  };
}

function getPaperTargetPositionSizing(alert, tradePlan) {
  const baseSizing = getPaperPositionSizing(alert, tradePlan);
  const maxSinglePositionUsd = roundTo(
    mulBn(PAPER_TOTAL_CAPITAL_USD, divBn(PAPER_MAX_SINGLE_POSITION_PCT, 100)),
    2
  );
  const targetPositionSizeUsd = roundTo(
    Math.min(baseSizing.positionSizeUsd, maxSinglePositionUsd || baseSizing.positionSizeUsd),
    2
  );
  const targetTokenAmount =
    Number(alert?.token?.price || 0) > 0
      ? roundTo(divBn(targetPositionSizeUsd, Number(alert.token.price || 0)), 6)
      : 0;

  return {
    ...baseSizing,
    targetPositionSizeUsd,
    targetTokenAmount,
    maxSinglePositionUsd,
  };
}

function getPositionEntryStage(position) {
  return Math.max(
    0,
    Math.min(
      PAPER_ENTRY_STAGE_ALLOCATIONS.length,
      Number(position?.entry_stage ?? position?.entryStage ?? 0)
    )
  );
}

function getPositionTargetPositionSizeUsd(position) {
  return Number(
    position?.target_position_size_usd ?? position?.targetPositionSizeUsd ?? position?.position_size_usd ??
      position?.positionSizeUsd ??
      0
  );
}

function getPaperEntrySizing(alert, tradePlan, position = null) {
  const targetSizing = getPaperTargetPositionSizing(alert, tradePlan);
  const entryPrice = Number(alert?.token?.price || 0);
  const currentPositionSizeUsd = Number(position?.position_size_usd ?? position?.positionSizeUsd ?? 0);
  const currentStage = getPositionEntryStage(position);
  const targetPositionSizeUsd = position
    ? Math.max(currentPositionSizeUsd, getPositionTargetPositionSizeUsd(position))
    : targetSizing.targetPositionSizeUsd;
  const nextStageIndex = position ? currentStage : 0;
  const configuredStageUsd =
    targetPositionSizeUsd * (PAPER_ENTRY_STAGE_ALLOCATIONS[nextStageIndex] || 0);
  const remainingUsd = Math.max(0, roundTo(subBn(targetPositionSizeUsd, currentPositionSizeUsd), 2));
  const stagePositionSizeUsd =
    nextStageIndex >= PAPER_ENTRY_STAGE_ALLOCATIONS.length
      ? 0
      : roundTo(
          nextStageIndex === PAPER_ENTRY_STAGE_ALLOCATIONS.length - 1
            ? remainingUsd
            : Math.min(configuredStageUsd, remainingUsd),
          2
        );
  const tokenAmount = entryPrice > 0 ? roundTo(divBn(stagePositionSizeUsd, entryPrice), 6) : 0;
  const nextEntryStage = Math.min(PAPER_ENTRY_STAGE_ALLOCATIONS.length, currentStage + 1);
  const filledPositionPct =
    targetPositionSizeUsd > 0
      ? roundTo(
          mulBn(
            divBn(addBn(currentPositionSizeUsd, stagePositionSizeUsd), targetPositionSizeUsd),
            100
          ),
          1
        )
      : 0;

  return {
    ...targetSizing,
    positionSizeUsd: stagePositionSizeUsd,
    tokenAmount,
    targetPositionSizeUsd,
    nextEntryStage,
    filledPositionPct,
  };
}

function evaluateTradeIntent(alert, options = {}) {
  const candidate = normalizeTradeCandidate(alert);
  const scoreInfo = getTradeScore(alert);
  const historyScores =
    options.historyScores || getTradeScoreHistoryFromAlert(alert);
  const scoreStats = getTradeScoreStats(scoreInfo.score, historyScores);
  const openPosition = options.openPosition || null;
  const hasOpenPosition = Boolean(openPosition);
  const currentEntryStage = getPositionEntryStage(openPosition);
  const reasons = [];

  if (!hasOpenPosition && scoreInfo.score < TRADE_SCORE_THRESHOLD) {
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
  if (candidate.ageHours > TRADE_MAX_TOKEN_AGE_HOURS) {
    reasons.push(`Token 币龄超过 ${TRADE_MAX_TOKEN_AGE_HOURS} 小时`);
  }
  if (candidate.chg_1h >= TRADE_HOT_MODE_CHANGE_1H) {
    if (scoreInfo.score < TRADE_HOT_MODE_MIN_SCORE) {
      reasons.push(`高热模式下评分需达到 ${TRADE_HOT_MODE_MIN_SCORE}`);
    }
    if (candidate.sm < TRADE_HOT_MODE_MIN_SMART_MONEY) {
      reasons.push(`高热模式下聪明钱需达到 ${TRADE_HOT_MODE_MIN_SMART_MONEY}`);
    }
    if (candidate.liq < TRADE_HOT_MODE_MIN_LIQUIDITY) {
      reasons.push(`高热模式下流动性需达到 ${TRADE_HOT_MODE_MIN_LIQUIDITY}`);
    }
    if (scoreInfo.buySellRatio < TRADE_HOT_MODE_MIN_BUY_SELL_RATIO) {
      reasons.push(`高热模式下买卖比需达到 ${TRADE_HOT_MODE_MIN_BUY_SELL_RATIO}`);
    }
  }

  let positionAction = 'open_head';
  let successLabel = '满足链上模拟交易头仓条件';
  if (!hasOpenPosition) {
    if (candidate.signalCount > TRADE_SECOND_HEAD_ENTRY_SIGNAL_COUNT) {
      reasons.push(`头仓仅允许第 ${TRADE_HEAD_ENTRY_SIGNAL_COUNT}-${TRADE_SECOND_HEAD_ENTRY_SIGNAL_COUNT} 次信号建立`);
    } else if (candidate.signalCount > TRADE_HEAD_ENTRY_SIGNAL_COUNT) {
      const hasPreviousScore = historyScores.length > 0;
      const previousScore = Number(scoreStats.previousScore || 0);
      const scoreDelta = scoreInfo.score - previousScore;
      const scoreStrengthenedEnough = scoreDelta >= TRADE_SECOND_HEAD_MIN_SCORE_DELTA;

      positionAction = 'open_head_retry';
      successLabel = `第2次信号评分至少走强 ${TRADE_SECOND_HEAD_MIN_SCORE_DELTA} 分，允许补开头仓`;

      if (!hasPreviousScore) {
        reasons.push('缺少上一次评分记录，暂不允许第2次信号补开头仓');
      } else if (scoreInfo.score < TRADE_SECOND_HEAD_MIN_SCORE) {
        reasons.push(`第2次补开头仓评分低于 ${TRADE_SECOND_HEAD_MIN_SCORE}`);
      } else if (!scoreStrengthenedEnough) {
        reasons.push(
          `第2次信号评分走强不足 ${TRADE_SECOND_HEAD_MIN_SCORE_DELTA} 分 (${scoreInfo.score} vs ${previousScore})`
        );
      }
    }
  } else {
    positionAction = 'hold_existing';
    successLabel = '已有打开持仓，头仓已一次性买满';
    reasons.push('已持有目标仓位，当前策略不再分批加仓');
  }

  return {
    tradeScore: scoreInfo.score,
    scoreBreakdown: scoreInfo.parts,
    buySellRatio: scoreInfo.buySellRatio,
    scoreStats,
    approved: reasons.length === 0,
    decisionReason:
      reasons.length === 0
        ? `${successLabel} | 最近${scoreStats.recentScores.length}次均分 ${scoreStats.averageScore}`
        : reasons.join(' | '),
    intentStatus: reasons.length === 0 ? 'approved' : hasOpenPosition ? 'skipped' : 'rejected',
    positionAction,
  };
}

function getOpenPaperPosition(db, chain, address) {
  return db
    .prepare(
      `SELECT *
       FROM paper_positions
       WHERE chain = ? AND address = ? AND status = ?
       ORDER BY opened_at DESC, id DESC
       LIMIT 1`
    )
    .get(chain, address, 'open');
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
  let multiplier = 0.7;

  if (tradeScore >= 85) {
    multiplier = 1.2;
  } else if (tradeScore >= 80) {
    multiplier = 1;
  }

  if (smartMoney >= 8 && tradeScore >= 80) {
    multiplier = Math.min(multiplier + 0.05, 1.2);
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

function getRecentTradeScores(db, chain, address, limit = TRADE_SCORE_AVG_LOOKBACK - 1) {
  return db
    .prepare(
      `SELECT trade_score
       FROM trade_intents
       WHERE chain = ? AND address = ? AND trade_score IS NOT NULL
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(chain, address, limit)
    .reverse()
    .map((row) => Number(row.trade_score))
    .filter((score) => Number.isFinite(score));
}

function openPaperPosition(db, alert, tradePlan, createdAt, sizing) {
  const settings = getPaperTradeSettings(db);
  const finalSizing = sizing || getPaperEntrySizing(alert, tradePlan);
  const takeProfitSteps = normalizeTakeProfitSteps(settings.takeProfitSteps);
  const entryPrice = Number(alert.token.price || 0);
  db.prepare(`
    INSERT OR IGNORE INTO paper_positions (
      chain, address, name, symbol, image_url, entry_signal_count, trade_score, position_size_usd,
      target_position_size_usd,
      token_amount, remaining_token_amount, remaining_position_size_usd,
      realized_pnl_usd, realized_proceeds_usd, tp_stage, tp_plan_json,
      entry_price, current_price, take_profit_pct, stop_loss_pct, status,
      opened_at, updated_at, smart_money, buy_sell_ratio, liquidity, volume, entry_stage,
      peak_price, peak_pnl_pct
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    alert.token.chain,
    alert.token.address,
    alert.token.name,
    alert.token.symbol,
    alert.token.imageUrl || '',
    alert.signalCount,
    tradePlan.tradeScore,
    finalSizing.positionSizeUsd,
    finalSizing.targetPositionSizeUsd,
    finalSizing.tokenAmount,
    finalSizing.tokenAmount,
    finalSizing.positionSizeUsd,
    0,
    0,
    0,
    JSON.stringify(takeProfitSteps),
    entryPrice,
    entryPrice,
    takeProfitSteps[0]?.targetPercent || LEGACY_PAPER_TAKE_PROFIT_PERCENT,
    settings.stopLossPercent,
    'open',
    createdAt,
    createdAt,
    alert.token.sm || 0,
    tradePlan.buySellRatio,
    alert.token.liq || 0,
    alert.token.volume || 0,
    finalSizing.nextEntryStage,
    entryPrice,
    0
  );
}

function scaleIntoPaperPosition(db, position, alert, tradePlan, createdAt, sizing) {
  const addPositionUsd = Number(sizing?.positionSizeUsd || 0);
  const addTokenAmount = Number(sizing?.tokenAmount || 0);
  if (addPositionUsd <= 0 || addTokenAmount <= 0) {
    return;
  }

  const currentPrice = Number(alert.token.price || 0);
  const currentPositionSizeUsd = Number(position.position_size_usd || 0);
  const currentTokenAmount = Number(position.token_amount || 0);
  const currentRemainingPositionUsd = Number(
    position.remaining_position_size_usd || currentPositionSizeUsd || 0
  );
  const currentRemainingTokenAmount = Number(
    position.remaining_token_amount || currentTokenAmount || 0
  );
  const nextPositionSizeUsd = roundTo(addBn(currentPositionSizeUsd, addPositionUsd), 6);
  const nextTokenAmount = roundTo(addBn(currentTokenAmount, addTokenAmount), 6);
  const nextRemainingPositionUsd = roundTo(addBn(currentRemainingPositionUsd, addPositionUsd), 6);
  const nextRemainingTokenAmount = roundTo(addBn(currentRemainingTokenAmount, addTokenAmount), 6);
  const nextEntryPrice =
    nextTokenAmount > 0 ? roundTo(divBn(nextPositionSizeUsd, nextTokenAmount), 8) : currentPrice;
  const peakPrice = Math.max(Number(position.peak_price || 0), currentPrice, nextEntryPrice);
  const peakPnlPct =
    nextPositionSizeUsd > 0
      ? roundTo(
          mulBn(
            divBn(subBn(mulBn(peakPrice, nextTokenAmount), nextPositionSizeUsd), nextPositionSizeUsd),
            100
          ),
          2
        )
      : 0;

  db.prepare(`
    UPDATE paper_positions
    SET trade_score = ?, position_size_usd = ?, target_position_size_usd = ?, token_amount = ?,
        remaining_token_amount = ?, remaining_position_size_usd = ?, entry_price = ?,
        current_price = ?, updated_at = ?, smart_money = ?, buy_sell_ratio = ?, liquidity = ?,
        volume = ?, entry_stage = ?, peak_price = ?, peak_pnl_pct = ?
    WHERE id = ?
  `).run(
    tradePlan.tradeScore,
    nextPositionSizeUsd,
    sizing.targetPositionSizeUsd,
    nextTokenAmount,
    nextRemainingTokenAmount,
    nextRemainingPositionUsd,
    nextEntryPrice,
    currentPrice,
    createdAt,
    alert.token.sm || 0,
    tradePlan.buySellRatio,
    alert.token.liq || 0,
    alert.token.volume || 0,
    sizing.nextEntryStage,
    peakPrice,
    peakPnlPct,
    position.id
  );
}

function getOpenPositionMarkToMarket(position, currentPriceOverride = null) {
  const currentPrice = Number(currentPriceOverride ?? position.current_price ?? 0);
  const remainingTokenAmount = Number(
    position.remaining_token_amount ?? position.token_amount ?? 0
  );
  const remainingCostBasisUsd = Number(
    position.remaining_position_size_usd ?? position.position_size_usd ?? 0
  );
  const realizedPnlUsd = Number(position.realized_pnl_usd || 0);
  const currentValueUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 2);
  const pnlUsd = roundTo(addBn(realizedPnlUsd, subBn(currentValueUsd, remainingCostBasisUsd)), 2);
  const totalCostUsd = Number(position.position_size_usd || 0);
  const pnlPct = totalCostUsd > 0 ? roundTo(mulBn(divBn(pnlUsd, totalCostUsd), 100), 2) : 0;

  return {
    currentPrice,
    remainingTokenAmount,
    remainingCostBasisUsd,
    realizedPnlUsd,
    currentValueUsd,
    pnlUsd,
    pnlPct,
  };
}

function getPositionOpenedAtTs(position) {
  if (Number.isFinite(Number(position?.opened_at))) {
    return Number(position.opened_at);
  }
  if (position?.openedAt) {
    const parsed = Date.parse(position.openedAt);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  return 0;
}

function getPositionPeakPrice(position, currentPrice, entryPrice) {
  return Math.max(
    Number(position?.peak_price ?? position?.peakPrice ?? 0),
    Number(currentPrice || 0),
    Number(entryPrice || 0)
  );
}

function getTrailingStopState(entryPrice, peakPrice, settings) {
  const normalized = normalizePaperTradeSettings(settings);
  const activationPrice = Number(entryPrice || 0) * (1 + normalized.trailingStartPercent / 100);
  const active = activationPrice > 0 && Number(peakPrice || 0) >= activationPrice;

  return {
    active,
    activationPrice,
    stopPrice: active ? Number(peakPrice || 0) * (1 - normalized.trailingStopPercent / 100) : 0,
  };
}

function shouldCloseForTimeStop(position, currentPrice, updatedAtTs, takeProfitSteps, settings) {
  const normalized = normalizePaperTradeSettings(settings);
  const openedAtTs = getPositionOpenedAtTs(position);
  if (!openedAtTs || normalized.timeStopHours <= 0) {
    return false;
  }

  const elapsedHours = (updatedAtTs - openedAtTs) / 3600;
  if (elapsedHours < normalized.timeStopHours) {
    return false;
  }

  const firstTakeProfitTarget = takeProfitSteps[0]?.targetPercent || 0;
  const firstTakeProfitPrice = Number(position.entry_price ?? position.entryPrice ?? 0) *
    (1 + firstTakeProfitTarget / 100);
  return Number(position.tp_stage ?? position.tpStage ?? 0) === 0 && Number(currentPrice || 0) < firstTakeProfitPrice;
}

function updatePaperPositions(db, tokens, updatedAt) {
  const settings = getPaperTradeSettings(db);
  const tokenMap = new Map(tokens.map((token) => [`${token.chain}:${token.address}`, token]));
  const openPositions = db
    .prepare('SELECT * FROM paper_positions WHERE status = ? ORDER BY opened_at DESC')
    .all('open');

  const updateStmt = db.prepare(`
    UPDATE paper_positions
    SET current_price = ?, pnl_pct = ?, updated_at = ?, remaining_token_amount = ?,
        remaining_position_size_usd = ?, realized_pnl_usd = ?, realized_proceeds_usd = ?,
        tp_stage = ?, tp_plan_json = ?, take_profit_pct = ?, stop_loss_pct = ?,
        peak_price = ?, peak_pnl_pct = ?
    WHERE id = ?
  `);
  const closeStmt = db.prepare(`
    UPDATE paper_positions
    SET status = ?, current_price = ?, close_price = ?, close_reason = ?,
        pnl_pct = ?, updated_at = ?, closed_at = ?, remaining_token_amount = ?,
        remaining_position_size_usd = ?, realized_pnl_usd = ?, realized_proceeds_usd = ?,
        tp_stage = ?, tp_plan_json = ?, take_profit_pct = ?, stop_loss_pct = ?,
        peak_price = ?, peak_pnl_pct = ?
    WHERE id = ?
  `);

  for (const position of openPositions) {
    const token = tokenMap.get(`${position.chain}:${position.address}`);
    if (!token || !token.price || !position.entry_price) {
      continue;
    }

    const takeProfitSteps = getPositionTakeProfitSteps(position, settings);
    let remainingTokenAmount = Number(position.remaining_token_amount || position.token_amount || 0);
    let remainingCostBasisUsd = Number(
      position.remaining_position_size_usd || position.position_size_usd || 0
    );
    let realizedPnlUsd = Number(position.realized_pnl_usd || 0);
    let realizedProceedsUsd = Number(position.realized_proceeds_usd || 0);
    let tpStage = Number(position.tp_stage || 0);
    const currentPrice = Number(token.price || 0);
    const stopLossPercent = Number(position.stop_loss_pct || settings.stopLossPercent);
    const peakPrice = getPositionPeakPrice(position, currentPrice, position.entry_price);

    while (tpStage < takeProfitSteps.length && remainingTokenAmount > 0) {
      const step = takeProfitSteps[tpStage];
      const tpPrice = position.entry_price * (1 + step.targetPercent / 100);
      if (currentPrice < tpPrice) {
        break;
      }

      const targetSellTokenAmount = Number(position.token_amount || 0) * Math.min(step.sellPercent / 100, 1);
      const sellTokenAmount = Math.min(remainingTokenAmount, roundTo(targetSellTokenAmount, 6));

      if (sellTokenAmount <= 0) {
        break;
      }

      const costBasisSoldUsd =
        remainingTokenAmount > 0
          ? roundTo(mulBn(remainingCostBasisUsd, divBn(sellTokenAmount, remainingTokenAmount)), 6)
          : 0;
      const proceedsUsd = roundTo(mulBn(sellTokenAmount, currentPrice), 6);
      realizedProceedsUsd = roundTo(addBn(realizedProceedsUsd, proceedsUsd), 6);
      realizedPnlUsd = roundTo(addBn(realizedPnlUsd, subBn(proceedsUsd, costBasisSoldUsd)), 6);
      remainingTokenAmount = Math.max(0, roundTo(subBn(remainingTokenAmount, sellTokenAmount), 6));
      remainingCostBasisUsd = Math.max(
        0,
        roundTo(subBn(remainingCostBasisUsd, costBasisSoldUsd), 6)
      );
      tpStage += 1;
    }

    const nextTakeProfitPct =
      takeProfitSteps[tpStage]?.targetPercent || takeProfitSteps[takeProfitSteps.length - 1]?.targetPercent || 0;
    const pnlSnapshot = getOpenPositionMarkToMarket(
      {
        ...position,
        current_price: currentPrice,
        remaining_token_amount: remainingTokenAmount,
        remaining_position_size_usd: remainingCostBasisUsd,
        realized_pnl_usd: realizedPnlUsd,
      },
      currentPrice
    );
    const peakPnlPct =
      Number(position.position_size_usd || 0) > 0
        ? roundTo(
            mulBn(
              divBn(
                subBn(mulBn(peakPrice, Number(position.token_amount || 0)), Number(position.position_size_usd || 0)),
                Number(position.position_size_usd || 1)
              ),
              100
            ),
            2
          )
        : 0;

    if (remainingTokenAmount <= 0) {
      closeStmt.run(
        'closed',
        currentPrice,
        currentPrice,
        `take_profit_stage_${tpStage}`,
        roundTo((realizedPnlUsd / Number(position.position_size_usd || 1)) * 100, 2),
        updatedAt,
        updatedAt,
        0,
        0,
        roundTo(realizedPnlUsd, 2),
        roundTo(realizedProceedsUsd, 2),
        tpStage,
        JSON.stringify(takeProfitSteps),
        nextTakeProfitPct,
        stopLossPercent,
        roundTo(peakPrice, 8),
        peakPnlPct,
        position.id
      );
      continue;
    }

    const slPrice = position.entry_price * (1 - stopLossPercent / 100);
    if (currentPrice <= slPrice) {
      const finalProceedsUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 6);
      const totalRealizedProceedsUsd = roundTo(addBn(realizedProceedsUsd, finalProceedsUsd), 6);
      const totalRealizedPnlUsd = roundTo(
        addBn(realizedPnlUsd, subBn(finalProceedsUsd, remainingCostBasisUsd)),
        6
      );
      closeStmt.run(
        'closed',
        currentPrice,
        currentPrice,
        `stop_loss_${stopLossPercent}`,
        roundTo((totalRealizedPnlUsd / Number(position.position_size_usd || 1)) * 100, 2),
        updatedAt,
        updatedAt,
        0,
        0,
        roundTo(totalRealizedPnlUsd, 2),
        roundTo(totalRealizedProceedsUsd, 2),
        tpStage,
        JSON.stringify(takeProfitSteps),
        nextTakeProfitPct,
        stopLossPercent,
        roundTo(peakPrice, 8),
        peakPnlPct,
        position.id
      );
      continue;
    }

    const trailingState = getTrailingStopState(position.entry_price, peakPrice, settings);
    if (trailingState.active && currentPrice <= trailingState.stopPrice) {
      const finalProceedsUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 6);
      const totalRealizedProceedsUsd = roundTo(addBn(realizedProceedsUsd, finalProceedsUsd), 6);
      const totalRealizedPnlUsd = roundTo(
        addBn(realizedPnlUsd, subBn(finalProceedsUsd, remainingCostBasisUsd)),
        6
      );
      closeStmt.run(
        'closed',
        currentPrice,
        currentPrice,
        `trailing_stop_${settings.trailingStopPercent}`,
        roundTo((totalRealizedPnlUsd / Number(position.position_size_usd || 1)) * 100, 2),
        updatedAt,
        updatedAt,
        0,
        0,
        roundTo(totalRealizedPnlUsd, 2),
        roundTo(totalRealizedProceedsUsd, 2),
        tpStage,
        JSON.stringify(takeProfitSteps),
        nextTakeProfitPct,
        stopLossPercent,
        roundTo(peakPrice, 8),
        peakPnlPct,
        position.id
      );
      continue;
    }

    if (shouldCloseForTimeStop(position, currentPrice, updatedAt, takeProfitSteps, settings)) {
      const finalProceedsUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 6);
      const totalRealizedProceedsUsd = roundTo(addBn(realizedProceedsUsd, finalProceedsUsd), 6);
      const totalRealizedPnlUsd = roundTo(
        addBn(realizedPnlUsd, subBn(finalProceedsUsd, remainingCostBasisUsd)),
        6
      );
      closeStmt.run(
        'closed',
        currentPrice,
        currentPrice,
        `time_stop_${settings.timeStopHours}h`,
        roundTo((totalRealizedPnlUsd / Number(position.position_size_usd || 1)) * 100, 2),
        updatedAt,
        updatedAt,
        0,
        0,
        roundTo(totalRealizedPnlUsd, 2),
        roundTo(totalRealizedProceedsUsd, 2),
        tpStage,
        JSON.stringify(takeProfitSteps),
        nextTakeProfitPct,
        stopLossPercent,
        roundTo(peakPrice, 8),
        peakPnlPct,
        position.id
      );
      continue;
    }

    updateStmt.run(
      currentPrice,
      roundTo(pnlSnapshot.pnlPct, 2),
      updatedAt,
      remainingTokenAmount,
      roundTo(remainingCostBasisUsd, 2),
      roundTo(realizedPnlUsd, 2),
      roundTo(realizedProceedsUsd, 2),
      tpStage,
      JSON.stringify(takeProfitSteps),
      nextTakeProfitPct,
      stopLossPercent,
      roundTo(peakPrice, 8),
      peakPnlPct,
      position.id
    );
  }
}

function getPaperAccountSummary(db) {
  const rows = db
    .prepare(
      `SELECT position_size_usd, remaining_position_size_usd, remaining_token_amount,
              current_price, realized_pnl_usd, realized_proceeds_usd, status
       FROM paper_positions`
    )
    .all();

  const openRows = rows.filter((row) => row.status === 'open');
  const closedRows = rows.filter((row) => row.status === 'closed');
  const totalOpenedCostUsd = sumBn(rows.map((row) => row.position_size_usd || 0));
  const openBuyUsd = sumBn(
    openRows.map((row) => row.remaining_position_size_usd || row.position_size_usd || 0)
  );
  const openMarketValueUsd = sumBn(
    openRows.map((row) => mulBn(row.remaining_token_amount || 0, row.current_price || 0))
  );
  const openRealizedPnlUsd = sumBn(openRows.map((row) => row.realized_pnl_usd || 0));
  const openRealizedProceedsUsd = sumBn(openRows.map((row) => row.realized_proceeds_usd || 0));
  const openPnLUsd = addBn(openRealizedPnlUsd, subBn(openMarketValueUsd, openBuyUsd));

  const closedBuyUsd = sumBn(closedRows.map((row) => row.position_size_usd || 0));
  const closedSellUsd = sumBn(closedRows.map((row) => row.realized_proceeds_usd || 0));
  const closedPnLUsd = sumBn(closedRows.map((row) => row.realized_pnl_usd || 0));

  const cashBalanceUsd = addBn(
    subBn(PAPER_TOTAL_CAPITAL_USD, totalOpenedCostUsd),
    closedSellUsd,
    openRealizedProceedsUsd
  );
  const equityUsd = addBn(cashBalanceUsd, openMarketValueUsd);
  const totalPnLUsd = addBn(openPnLUsd, closedPnLUsd);
  const capitalUsagePct =
    PAPER_TOTAL_CAPITAL_USD > 0 ? roundTo(mulBn(divBn(openBuyUsd, PAPER_TOTAL_CAPITAL_USD), 100), 2) : 0;

  return {
    totalCapitalUsd: roundTo(PAPER_TOTAL_CAPITAL_USD, 2),
    cashBalanceUsd: roundTo(cashBalanceUsd, 2),
    availableUsd: roundTo(cashBalanceUsd, 2),
    usedCapitalUsd: roundTo(openBuyUsd, 2),
    equityUsd: roundTo(equityUsd, 2),
    capitalUsagePct: roundTo(capitalUsagePct, 2),
    openBuyUsd: roundTo(openBuyUsd, 2),
    openMarketValueUsd: roundTo(openMarketValueUsd, 2),
    openPnLUsd: roundTo(openPnLUsd, 2),
    closedBuyUsd: roundTo(closedBuyUsd, 2),
    closedSellUsd: roundTo(closedSellUsd, 2),
    closedPnLUsd: roundTo(closedPnLUsd, 2),
    totalPnLUsd: roundTo(totalPnLUsd, 2),
  };
}

function getStrategyRuntimeInfoFromStartedAt(startedAt) {
  const startedAtTs = startedAt ? Math.floor(Date.parse(startedAt) / 1000) : 0;
  const strategyRuntimeSeconds =
    startedAtTs > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - startedAtTs) : 0;

  return {
    strategyStartedAt: startedAt,
    strategyRuntimeSeconds,
    strategyRuntimeLabel: formatRuntimeSeconds(strategyRuntimeSeconds),
  };
}

function getOpenPositionMarkToMarketState(position, currentPriceOverride = null) {
  const currentPrice = Number(currentPriceOverride ?? position.currentPrice ?? 0);
  const remainingTokenAmount = Number(position.remainingTokenAmount ?? position.tokenAmount ?? 0);
  const remainingCostBasisUsd = Number(
    position.remainingPositionSizeUsd ?? position.positionSizeUsd ?? 0
  );
  const realizedPnlUsd = Number(position.realizedPnlUsd || 0);
  const currentValueUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 2);
  const pnlUsd = roundTo(addBn(realizedPnlUsd, subBn(currentValueUsd, remainingCostBasisUsd)), 2);
  const totalCostUsd = Number(position.positionSizeUsd || 0);
  const pnlPct = totalCostUsd > 0 ? roundTo(mulBn(divBn(pnlUsd, totalCostUsd), 100), 2) : 0;

  return {
    currentPrice,
    remainingTokenAmount,
    remainingCostBasisUsd,
    realizedPnlUsd,
    currentValueUsd,
    pnlUsd,
    pnlPct,
  };
}

function normalizeRuntimePaperPositions(paperPositionsMap = new Map()) {
  return [...paperPositionsMap.values()].map((position) => ({
    ...position,
    twitter: position.twitter || '',
    positionSizeUsd: Number(position.positionSizeUsd || 0),
    tokenAmount: Number(position.tokenAmount || 0),
    remainingTokenAmount: Number(position.remainingTokenAmount ?? position.tokenAmount ?? 0),
    remainingPositionSizeUsd: Number(
      position.remainingPositionSizeUsd ?? position.positionSizeUsd ?? 0
    ),
    realizedPnlUsd: Number(position.realizedPnlUsd || 0),
    realizedProceedsUsd: Number(position.realizedProceedsUsd || 0),
    tpStage: Number(position.tpStage || 0),
    targetPositionSizeUsd: Number(
      position.targetPositionSizeUsd ?? position.positionSizeUsd ?? 0
    ),
    entryStage: Number(position.entryStage || PAPER_ENTRY_STAGE_ALLOCATIONS.length),
    entryPrice: Number(position.entryPrice || 0),
    currentPrice: Number(position.currentPrice || 0),
    peakPrice: Number(position.peakPrice ?? position.currentPrice ?? position.entryPrice ?? 0),
    peakPnlPct: Number(position.peakPnlPct || 0),
    takeProfitPct: Number(position.takeProfitPct || 0),
    stopLossPct: Number(position.stopLossPct || 0),
    pnlPct: Number(position.pnlPct || 0),
    smartMoney: Number(position.smartMoney || 0),
    buySellRatio: Number(position.buySellRatio || 0),
    liquidity: Number(position.liquidity || 0),
    volume: Number(position.volume || 0),
    currentValueUsd: Number(position.currentValueUsd || 0),
    pnlUsd: Number(position.pnlUsd || 0),
    takeProfitSteps: normalizeTakeProfitSteps(position.takeProfitSteps || []),
  }));
}

function getOpenPaperPositionInMemory(positions, chain, address) {
  return (
    positions.find(
      (position) => position.chain === chain && position.address === address && position.status === 'open'
    ) || null
  );
}

function getOpenPaperPositionCountInMemory(positions) {
  return positions.filter((position) => position.status === 'open').length;
}

function getPaperAccountSummaryFromPositions(positions) {
  const openRows = positions.filter((row) => row.status === 'open');
  const closedRows = positions.filter((row) => row.status === 'closed');
  const totalOpenedCostUsd = sumBn(positions.map((row) => row.positionSizeUsd || 0));
  const openBuyUsd = sumBn(
    openRows.map((row) => row.remainingPositionSizeUsd ?? row.positionSizeUsd ?? 0)
  );
  const openMarketValueUsd = sumBn(openRows.map((row) => row.currentValueUsd || 0));
  const openRealizedProceedsUsd = sumBn(openRows.map((row) => row.realizedProceedsUsd || 0));
  const openPnLUsd = sumBn(openRows.map((row) => row.pnlUsd || 0));
  const closedBuyUsd = sumBn(closedRows.map((row) => row.positionSizeUsd || 0));
  const closedSellUsd = sumBn(closedRows.map((row) => row.realizedProceedsUsd || 0));
  const closedPnLUsd = sumBn(closedRows.map((row) => row.realizedPnlUsd || 0));
  const cashBalanceUsd = addBn(
    subBn(PAPER_TOTAL_CAPITAL_USD, totalOpenedCostUsd),
    closedSellUsd,
    openRealizedProceedsUsd
  );
  const equityUsd = addBn(cashBalanceUsd, openMarketValueUsd);
  const totalPnLUsd = addBn(openPnLUsd, closedPnLUsd);
  const capitalUsagePct =
    PAPER_TOTAL_CAPITAL_USD > 0 ? roundTo(mulBn(divBn(openBuyUsd, PAPER_TOTAL_CAPITAL_USD), 100), 2) : 0;
  const winCount = closedRows.filter((row) => Number(row.pnlPct || 0) > 0).length;

  return {
    openCount: openRows.length,
    closedCount: closedRows.length,
    winCount,
    winRate:
      closedRows.length > 0 ? Number(((winCount / closedRows.length) * 100).toFixed(1)) : 0,
    openValueUsd: roundTo(openMarketValueUsd, 2),
    openCostUsd: roundTo(openBuyUsd, 2),
    openPnLUsd: roundTo(openPnLUsd, 2),
    closedCostUsd: roundTo(closedBuyUsd, 2),
    closedValueUsd: roundTo(closedSellUsd, 2),
    closedPnLUsd: roundTo(closedPnLUsd, 2),
    totalCapitalUsd: roundTo(PAPER_TOTAL_CAPITAL_USD, 2),
    cashBalanceUsd: roundTo(cashBalanceUsd, 2),
    availableUsd: roundTo(cashBalanceUsd, 2),
    usedCapitalUsd: roundTo(openBuyUsd, 2),
    equityUsd: roundTo(equityUsd, 2),
    capitalUsagePct: roundTo(capitalUsagePct, 2),
    totalPnLUsd: roundTo(totalPnLUsd, 2),
  };
}

function openPaperPositionInMemory(alert, tradePlan, createdAt, sizing, settings) {
  const finalSizing = sizing || getPaperEntrySizing(alert, tradePlan);
  const takeProfitSteps = normalizeTakeProfitSteps(settings.takeProfitSteps);
  const openedAtIso = new Date(createdAt * 1000).toISOString();
  const entryPrice = Number(alert.token.price || 0);

  return {
    id: `${alert.token.chain}:${alert.token.address}:${alert.signalCount}`,
    chain: alert.token.chain,
    address: alert.token.address,
    name: alert.token.name,
    symbol: alert.token.symbol,
    imageUrl: alert.token.imageUrl || '',
    entrySignalCount: alert.signalCount,
    tradeScore: tradePlan.tradeScore,
    positionSizeUsd: finalSizing.positionSizeUsd,
    targetPositionSizeUsd: finalSizing.targetPositionSizeUsd,
    tokenAmount: finalSizing.tokenAmount,
    remainingTokenAmount: finalSizing.tokenAmount,
    remainingPositionSizeUsd: finalSizing.positionSizeUsd,
    realizedPnlUsd: 0,
    realizedProceedsUsd: 0,
    tpStage: 0,
    takeProfitSteps,
    entryPrice,
    currentPrice: entryPrice,
    peakPrice: entryPrice,
    peakPnlPct: 0,
    takeProfitPct: takeProfitSteps[0]?.targetPercent || LEGACY_PAPER_TAKE_PROFIT_PERCENT,
    stopLossPct: settings.stopLossPercent,
    status: 'open',
    openedAt: openedAtIso,
    updatedAt: openedAtIso,
    closedAt: null,
    closePrice: null,
    closeReason: '',
    pnlPct: 0,
    twitter: alert.descInfo?.twitter || alert.token.twitter || '',
    smartMoney: alert.token.sm || 0,
    buySellRatio: tradePlan.buySellRatio,
    liquidity: alert.token.liq || 0,
    volume: alert.token.volume || 0,
    entryStage: finalSizing.nextEntryStage,
    currentValueUsd: finalSizing.positionSizeUsd,
    pnlUsd: 0,
  };
}

function scaleIntoPaperPositionInMemory(position, alert, tradePlan, createdAt, sizing) {
  const addPositionUsd = Number(sizing?.positionSizeUsd || 0);
  const addTokenAmount = Number(sizing?.tokenAmount || 0);
  if (addPositionUsd <= 0 || addTokenAmount <= 0) {
    return position;
  }

  const currentPrice = Number(alert.token.price || 0);
  const currentPositionSizeUsd = Number(position.positionSizeUsd || 0);
  const currentTokenAmount = Number(position.tokenAmount || 0);
  const currentRemainingPositionUsd = Number(position.remainingPositionSizeUsd ?? currentPositionSizeUsd);
  const currentRemainingTokenAmount = Number(position.remainingTokenAmount ?? currentTokenAmount);
  const nextPositionSizeUsd = roundTo(addBn(currentPositionSizeUsd, addPositionUsd), 6);
  const nextTokenAmount = roundTo(addBn(currentTokenAmount, addTokenAmount), 6);
  const nextRemainingPositionUsd = roundTo(addBn(currentRemainingPositionUsd, addPositionUsd), 6);
  const nextRemainingTokenAmount = roundTo(addBn(currentRemainingTokenAmount, addTokenAmount), 6);
  const nextEntryPrice =
    nextTokenAmount > 0 ? roundTo(divBn(nextPositionSizeUsd, nextTokenAmount), 8) : currentPrice;
  const peakPrice = Math.max(Number(position.peakPrice || 0), currentPrice, nextEntryPrice);
  const peakPnlPct =
    nextPositionSizeUsd > 0
      ? roundTo(
          mulBn(
            divBn(subBn(mulBn(peakPrice, nextTokenAmount), nextPositionSizeUsd), nextPositionSizeUsd),
            100
          ),
          2
        )
      : 0;

  return {
    ...position,
    tradeScore: tradePlan.tradeScore,
    positionSizeUsd: nextPositionSizeUsd,
    targetPositionSizeUsd: sizing.targetPositionSizeUsd,
    tokenAmount: nextTokenAmount,
    remainingTokenAmount: nextRemainingTokenAmount,
    remainingPositionSizeUsd: nextRemainingPositionUsd,
    entryPrice: nextEntryPrice,
    currentPrice,
    updatedAt: new Date(createdAt * 1000).toISOString(),
    smartMoney: alert.token.sm || 0,
    buySellRatio: tradePlan.buySellRatio,
    liquidity: alert.token.liq || 0,
    volume: alert.token.volume || 0,
    entryStage: sizing.nextEntryStage,
    peakPrice: roundTo(peakPrice, 8),
    peakPnlPct,
    currentValueUsd: roundTo(mulBn(nextRemainingTokenAmount, currentPrice), 2),
    pnlUsd: roundTo(subBn(mulBn(nextRemainingTokenAmount, currentPrice), nextRemainingPositionUsd), 2),
  };
}

function updatePaperPositionsInMemory(positions, tokens, updatedAt, settings) {
  const tokenMap = new Map(tokens.map((token) => [`${token.chain}:${token.address}`, token]));
  const updatedAtIso = new Date(updatedAt * 1000).toISOString();

  return positions.map((position) => {
    if (position.status !== 'open') {
      return position;
    }

    const token = tokenMap.get(`${position.chain}:${position.address}`);
    if (!token || !token.price || !position.entryPrice) {
      return position;
    }

    const takeProfitSteps = normalizeTakeProfitSteps(position.takeProfitSteps || settings.takeProfitSteps);
    let remainingTokenAmount = Number(position.remainingTokenAmount ?? position.tokenAmount ?? 0);
    let remainingCostBasisUsd = Number(
      position.remainingPositionSizeUsd ?? position.positionSizeUsd ?? 0
    );
    let realizedPnlUsd = Number(position.realizedPnlUsd || 0);
    let realizedProceedsUsd = Number(position.realizedProceedsUsd || 0);
    let tpStage = Number(position.tpStage || 0);
    const currentPrice = Number(token.price || 0);
    const stopLossPercent = Number(position.stopLossPct || settings.stopLossPercent);
    const peakPrice = getPositionPeakPrice(position, currentPrice, position.entryPrice);

    while (tpStage < takeProfitSteps.length && remainingTokenAmount > 0) {
      const step = takeProfitSteps[tpStage];
      const tpPrice = position.entryPrice * (1 + step.targetPercent / 100);
      if (currentPrice < tpPrice) {
        break;
      }

      const targetSellTokenAmount = Number(position.tokenAmount || 0) * Math.min(step.sellPercent / 100, 1);
      const sellTokenAmount = Math.min(remainingTokenAmount, roundTo(targetSellTokenAmount, 6));

      if (sellTokenAmount <= 0) {
        break;
      }

      const costBasisSoldUsd =
        remainingTokenAmount > 0
          ? roundTo(mulBn(remainingCostBasisUsd, divBn(sellTokenAmount, remainingTokenAmount)), 6)
          : 0;
      const proceedsUsd = roundTo(mulBn(sellTokenAmount, currentPrice), 6);
      realizedProceedsUsd = roundTo(addBn(realizedProceedsUsd, proceedsUsd), 6);
      realizedPnlUsd = roundTo(addBn(realizedPnlUsd, subBn(proceedsUsd, costBasisSoldUsd)), 6);
      remainingTokenAmount = Math.max(0, roundTo(subBn(remainingTokenAmount, sellTokenAmount), 6));
      remainingCostBasisUsd = Math.max(0, roundTo(subBn(remainingCostBasisUsd, costBasisSoldUsd), 6));
      tpStage += 1;
    }

    const nextTakeProfitPct =
      takeProfitSteps[tpStage]?.targetPercent ||
      takeProfitSteps[takeProfitSteps.length - 1]?.targetPercent ||
      0;
    const pnlSnapshot = getOpenPositionMarkToMarketState(
      {
        ...position,
        currentPrice,
        remainingTokenAmount,
        remainingPositionSizeUsd: remainingCostBasisUsd,
        realizedPnlUsd,
      },
      currentPrice
    );
    const peakPnlPct =
      Number(position.positionSizeUsd || 0) > 0
        ? roundTo(
            mulBn(
              divBn(
                subBn(mulBn(peakPrice, Number(position.tokenAmount || 0)), Number(position.positionSizeUsd || 0)),
                Number(position.positionSizeUsd || 1)
              ),
              100
            ),
            2
          )
        : 0;

    if (remainingTokenAmount <= 0) {
      return {
        ...position,
        status: 'closed',
        currentPrice,
        closePrice: currentPrice,
        closeReason: `take_profit_stage_${tpStage}`,
        pnlPct: roundTo((realizedPnlUsd / Number(position.positionSizeUsd || 1)) * 100, 2),
        updatedAt: updatedAtIso,
        closedAt: updatedAtIso,
        remainingTokenAmount: 0,
        remainingPositionSizeUsd: 0,
        realizedPnlUsd: roundTo(realizedPnlUsd, 2),
        realizedProceedsUsd: roundTo(realizedProceedsUsd, 2),
        tpStage,
        takeProfitSteps,
        takeProfitPct: nextTakeProfitPct,
        stopLossPct: stopLossPercent,
        peakPrice: roundTo(peakPrice, 8),
        peakPnlPct,
        currentValueUsd: 0,
        pnlUsd: roundTo(realizedPnlUsd, 2),
      };
    }

    const slPrice = position.entryPrice * (1 - stopLossPercent / 100);
    if (currentPrice <= slPrice) {
      const finalProceedsUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 6);
      const totalRealizedProceedsUsd = roundTo(addBn(realizedProceedsUsd, finalProceedsUsd), 6);
      const totalRealizedPnlUsd = roundTo(
        addBn(realizedPnlUsd, subBn(finalProceedsUsd, remainingCostBasisUsd)),
        6
      );
      return {
        ...position,
        status: 'closed',
        currentPrice,
        closePrice: currentPrice,
        closeReason: `stop_loss_${stopLossPercent}`,
        pnlPct: roundTo((totalRealizedPnlUsd / Number(position.positionSizeUsd || 1)) * 100, 2),
        updatedAt: updatedAtIso,
        closedAt: updatedAtIso,
        remainingTokenAmount: 0,
        remainingPositionSizeUsd: 0,
        realizedPnlUsd: roundTo(totalRealizedPnlUsd, 2),
        realizedProceedsUsd: roundTo(totalRealizedProceedsUsd, 2),
        tpStage,
        takeProfitSteps,
        takeProfitPct: nextTakeProfitPct,
        stopLossPct: stopLossPercent,
        peakPrice: roundTo(peakPrice, 8),
        peakPnlPct,
        currentValueUsd: 0,
        pnlUsd: roundTo(totalRealizedPnlUsd, 2),
      };
    }

    const trailingState = getTrailingStopState(position.entryPrice, peakPrice, settings);
    if (trailingState.active && currentPrice <= trailingState.stopPrice) {
      const finalProceedsUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 6);
      const totalRealizedProceedsUsd = roundTo(addBn(realizedProceedsUsd, finalProceedsUsd), 6);
      const totalRealizedPnlUsd = roundTo(
        addBn(realizedPnlUsd, subBn(finalProceedsUsd, remainingCostBasisUsd)),
        6
      );
      return {
        ...position,
        status: 'closed',
        currentPrice,
        closePrice: currentPrice,
        closeReason: `trailing_stop_${settings.trailingStopPercent}`,
        pnlPct: roundTo((totalRealizedPnlUsd / Number(position.positionSizeUsd || 1)) * 100, 2),
        updatedAt: updatedAtIso,
        closedAt: updatedAtIso,
        remainingTokenAmount: 0,
        remainingPositionSizeUsd: 0,
        realizedPnlUsd: roundTo(totalRealizedPnlUsd, 2),
        realizedProceedsUsd: roundTo(totalRealizedProceedsUsd, 2),
        tpStage,
        takeProfitSteps,
        takeProfitPct: nextTakeProfitPct,
        stopLossPct: stopLossPercent,
        peakPrice: roundTo(peakPrice, 8),
        peakPnlPct,
        currentValueUsd: 0,
        pnlUsd: roundTo(totalRealizedPnlUsd, 2),
      };
    }

    if (shouldCloseForTimeStop(position, currentPrice, updatedAt, takeProfitSteps, settings)) {
      const finalProceedsUsd = roundTo(mulBn(remainingTokenAmount, currentPrice), 6);
      const totalRealizedProceedsUsd = roundTo(addBn(realizedProceedsUsd, finalProceedsUsd), 6);
      const totalRealizedPnlUsd = roundTo(
        addBn(realizedPnlUsd, subBn(finalProceedsUsd, remainingCostBasisUsd)),
        6
      );
      return {
        ...position,
        status: 'closed',
        currentPrice,
        closePrice: currentPrice,
        closeReason: `time_stop_${settings.timeStopHours}h`,
        pnlPct: roundTo((totalRealizedPnlUsd / Number(position.positionSizeUsd || 1)) * 100, 2),
        updatedAt: updatedAtIso,
        closedAt: updatedAtIso,
        remainingTokenAmount: 0,
        remainingPositionSizeUsd: 0,
        realizedPnlUsd: roundTo(totalRealizedPnlUsd, 2),
        realizedProceedsUsd: roundTo(totalRealizedProceedsUsd, 2),
        tpStage,
        takeProfitSteps,
        takeProfitPct: nextTakeProfitPct,
        stopLossPct: stopLossPercent,
        peakPrice: roundTo(peakPrice, 8),
        peakPnlPct,
        currentValueUsd: 0,
        pnlUsd: roundTo(totalRealizedPnlUsd, 2),
      };
    }

    return {
      ...position,
      currentPrice,
      pnlPct: roundTo(pnlSnapshot.pnlPct, 2),
      updatedAt: updatedAtIso,
      remainingTokenAmount,
      remainingPositionSizeUsd: roundTo(remainingCostBasisUsd, 2),
      realizedPnlUsd: roundTo(realizedPnlUsd, 2),
      realizedProceedsUsd: roundTo(realizedProceedsUsd, 2),
      tpStage,
      takeProfitSteps,
      takeProfitPct: nextTakeProfitPct,
      stopLossPct: stopLossPercent,
      peakPrice: roundTo(peakPrice, 8),
      peakPnlPct,
      currentValueUsd: roundTo(pnlSnapshot.currentValueUsd, 2),
      pnlUsd: roundTo(pnlSnapshot.pnlUsd, 2),
    };
  });
}

function buildHistoryScoreMapFromAlerts(alerts = []) {
  const map = new Map();
  for (const alert of alerts) {
    if (!alert?.chain || !alert?.address) {
      continue;
    }
    const scores = getTradeScoreHistoryFromAlert(alert);
    if (scores.length > 0) {
      map.set(`${alert.chain}:${alert.address}`, scores);
    }
  }
  return map;
}

function processTradePlansInMemory(positions, alerts, tokens, createdAt, settings, historyScoreMap = new Map()) {
  const nextPositions = updatePaperPositionsInMemory(positions, tokens, createdAt, settings);
  const candidates = alerts
    .map((alert) => {
      const historyScores = historyScoreMap.get(`${alert.token.chain}:${alert.token.address}`) || [];
      return { alert, tradePlan: evaluateTradeIntent(alert, { historyScores }) };
    })
    .sort((left, right) => {
      if ((right.tradePlan.tradeScore || 0) !== (left.tradePlan.tradeScore || 0)) {
        return (right.tradePlan.tradeScore || 0) - (left.tradePlan.tradeScore || 0);
      }
      if ((right.alert.token.sm || 0) !== (left.alert.token.sm || 0)) {
        return (right.alert.token.sm || 0) - (left.alert.token.sm || 0);
      }
      return (right.alert.pctGain || 0) - (left.alert.pctGain || 0);
    });

  for (const { alert } of candidates) {
    const historyScores = historyScoreMap.get(`${alert.token.chain}:${alert.token.address}`) || [];
    const openPosition = getOpenPaperPositionInMemory(
      nextPositions,
      alert.token.chain,
      alert.token.address
    );
    const evaluatedPlan = evaluateTradeIntent(alert, { historyScores, openPosition });
    const sizing = getPaperEntrySizing(alert, evaluatedPlan, openPosition);
    if (evaluatedPlan.approved) {
      const account = getPaperAccountSummaryFromPositions(nextPositions);
      const nextUsedCapitalUsd = account.usedCapitalUsd + sizing.positionSizeUsd;
      const nextUsagePct =
        PAPER_TOTAL_CAPITAL_USD > 0 ? (nextUsedCapitalUsd / PAPER_TOTAL_CAPITAL_USD) * 100 : 0;

      if (!openPosition && getOpenPaperPositionCountInMemory(nextPositions) >= PAPER_MAX_OPEN_POSITIONS) {
        evaluatedPlan.approved = false;
        evaluatedPlan.intentStatus = 'rejected';
        evaluatedPlan.decisionReason = `打开持仓数已达上限 ${PAPER_MAX_OPEN_POSITIONS}`;
      } else if (sizing.positionSizeUsd <= 0) {
        evaluatedPlan.approved = false;
        evaluatedPlan.intentStatus = openPosition ? 'skipped' : 'rejected';
        evaluatedPlan.decisionReason = openPosition ? '目标仓位已完成' : '头仓目标仓位无效';
      } else if (nextUsagePct > PAPER_MAX_CAPITAL_USAGE_PCT) {
        evaluatedPlan.approved = false;
        evaluatedPlan.intentStatus = 'rejected';
        evaluatedPlan.decisionReason = `资金使用率将达 ${nextUsagePct.toFixed(1)}%，超过上限 ${PAPER_MAX_CAPITAL_USAGE_PCT}%`;
      }
    }

    if (evaluatedPlan.approved) {
      const account = getPaperAccountSummaryFromPositions(nextPositions);
      if (sizing.positionSizeUsd > account.availableUsd) {
        evaluatedPlan.approved = false;
        evaluatedPlan.intentStatus = 'rejected';
        evaluatedPlan.decisionReason = `可用余额不足，需 ${sizing.positionSizeUsd.toFixed(2)} USD，剩余 ${account.availableUsd.toFixed(2)} USD`;
      }
    }

    if (evaluatedPlan.approved) {
      if (openPosition) {
        const nextPosition = scaleIntoPaperPositionInMemory(
          openPosition,
          alert,
          evaluatedPlan,
          createdAt,
          sizing
        );
        const index = nextPositions.findIndex((position) => position.id === openPosition.id);
        if (index >= 0) {
          nextPositions[index] = nextPosition;
        }
      } else {
        nextPositions.push(openPaperPositionInMemory(alert, evaluatedPlan, createdAt, sizing, settings));
      }
    }

    alert.tradePlan = evaluatedPlan;
  }

  return nextPositions;
}

function processTradePlans(db, alerts, tokens, createdAt) {
  updatePaperPositions(db, tokens, createdAt);

  const candidates = alerts
    .map((alert) => {
      const historyScores = getRecentTradeScores(db, alert.token.chain, alert.token.address);
      return { alert, tradePlan: evaluateTradeIntent(alert, { historyScores }) };
    })
    .sort((left, right) => {
      if ((right.tradePlan.tradeScore || 0) !== (left.tradePlan.tradeScore || 0)) {
        return (right.tradePlan.tradeScore || 0) - (left.tradePlan.tradeScore || 0);
      }
      if ((right.alert.token.sm || 0) !== (left.alert.token.sm || 0)) {
        return (right.alert.token.sm || 0) - (left.alert.token.sm || 0);
      }
      return (right.alert.pctGain || 0) - (left.alert.pctGain || 0);
    });

  for (const { alert } of candidates) {
    const openPosition = getOpenPaperPosition(db, alert.token.chain, alert.token.address);
    const historyScores = getRecentTradeScores(db, alert.token.chain, alert.token.address);
    const evaluatedPlan = evaluateTradeIntent(alert, { historyScores, openPosition });
    const sizing = getPaperEntrySizing(alert, evaluatedPlan, openPosition);
    if (evaluatedPlan.approved) {
      const account = getPaperAccountSummary(db);
      const nextUsedCapitalUsd = account.usedCapitalUsd + sizing.positionSizeUsd;
      const nextUsagePct =
        PAPER_TOTAL_CAPITAL_USD > 0 ? (nextUsedCapitalUsd / PAPER_TOTAL_CAPITAL_USD) * 100 : 0;

      if (!openPosition && getOpenPaperPositionCount(db) >= PAPER_MAX_OPEN_POSITIONS) {
        evaluatedPlan.approved = false;
        evaluatedPlan.intentStatus = 'rejected';
        evaluatedPlan.decisionReason = `打开持仓数已达上限 ${PAPER_MAX_OPEN_POSITIONS}`;
      } else if (sizing.positionSizeUsd <= 0) {
        evaluatedPlan.approved = false;
        evaluatedPlan.intentStatus = openPosition ? 'skipped' : 'rejected';
        evaluatedPlan.decisionReason = openPosition ? '目标仓位已完成' : '头仓目标仓位无效';
      } else if (nextUsagePct > PAPER_MAX_CAPITAL_USAGE_PCT) {
        evaluatedPlan.approved = false;
        evaluatedPlan.intentStatus = 'rejected';
        evaluatedPlan.decisionReason = `资金使用率将达 ${nextUsagePct.toFixed(1)}%，超过上限 ${PAPER_MAX_CAPITAL_USAGE_PCT}%`;
      }
    }

    if (evaluatedPlan.approved) {
      const account = getPaperAccountSummary(db);
      if (sizing.positionSizeUsd > account.availableUsd) {
        evaluatedPlan.approved = false;
        evaluatedPlan.intentStatus = 'rejected';
        evaluatedPlan.decisionReason = `可用余额不足，需 ${sizing.positionSizeUsd.toFixed(2)} USD，剩余 ${account.availableUsd.toFixed(2)} USD`;
      }
    }

    recordTradeIntent(db, alert, evaluatedPlan, createdAt);

    if (evaluatedPlan.approved) {
      if (openPosition) {
        scaleIntoPaperPosition(db, openPosition, alert, evaluatedPlan, createdAt, sizing);
      } else {
        openPaperPosition(db, alert, evaluatedPlan, createdAt, sizing);
      }
    }

    alert.tradePlan = evaluatedPlan;
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
      `SELECT
         paper_positions.*,
         (
           SELECT pushed_alerts.twitter
           FROM pushed_alerts
           WHERE pushed_alerts.chain = paper_positions.chain
             AND pushed_alerts.address = paper_positions.address
             AND pushed_alerts.twitter IS NOT NULL
             AND pushed_alerts.twitter != ''
           ORDER BY pushed_alerts.pushed_at DESC, pushed_alerts.id DESC
           LIMIT 1
         ) AS twitter
       FROM paper_positions
       WHERE status = ?
       ORDER BY updated_at DESC, opened_at DESC
       LIMIT ?`
    )
    .all(status, limit);

  return rows.map((row) => {
    const takeProfitSteps = getPositionTakeProfitSteps(row, getPaperTradeSettings(db));
    const remainingTokenAmount = Number(row.remaining_token_amount || row.token_amount || 0);
    const remainingPositionSizeUsd = Number(
      row.remaining_position_size_usd || row.position_size_usd || 0
    );
    const currentValueUsd = roundTo(mulBn(remainingTokenAmount, Number(row.current_price || 0)), 2);
    const realizedPnlUsd = Number(row.realized_pnl_usd || 0);
    const pnlUsd = roundTo(addBn(realizedPnlUsd, subBn(currentValueUsd, remainingPositionSizeUsd)), 2);

    return {
      id: row.id,
      chain: row.chain,
      address: row.address,
      name: row.name,
      symbol: row.symbol,
      imageUrl: row.image_url || '',
      entrySignalCount: row.entry_signal_count,
      tradeScore: row.trade_score,
      positionSizeUsd: Number(row.position_size_usd || 0),
      targetPositionSizeUsd: Number(row.target_position_size_usd || row.position_size_usd || 0),
      tokenAmount: Number(row.token_amount || 0),
      remainingTokenAmount,
      remainingPositionSizeUsd,
      entryPrice: row.entry_price,
      currentPrice: row.current_price,
      peakPrice: Number(row.peak_price || row.current_price || row.entry_price || 0),
      peakPnlPct: Number(row.peak_pnl_pct || 0),
      currentValueUsd,
      pnlPct: row.pnl_pct,
      pnlUsd,
      takeProfitPct: row.take_profit_pct,
      takeProfitSteps,
      stopLossPct: row.stop_loss_pct,
      status: row.status,
      smartMoney: row.smart_money,
      buySellRatio: row.buy_sell_ratio,
      liquidity: row.liquidity,
      volume: row.volume,
      realizedPnlUsd,
      realizedProceedsUsd: Number(row.realized_proceeds_usd || 0),
      tpStage: Number(row.tp_stage || 0),
      entryStage: Number(row.entry_stage || PAPER_ENTRY_STAGE_ALLOCATIONS.length),
      openedAt: row.opened_at ? new Date(row.opened_at * 1000).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at * 1000).toISOString() : null,
      closedAt: row.closed_at ? new Date(row.closed_at * 1000).toISOString() : null,
      closePrice: row.close_price,
      closeReason: row.close_reason || '',
      twitter: row.twitter || '',
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
    const previewPlan = evaluateTradeIntent(alert, {
      historyScores: getTradeScoreHistoryFromAlert(alert),
      openPosition: position?.status === 'open' ? position : null,
    });
    const paperTradeSettings = getPaperTradeSettings(db);
    const takeProfitSteps = position
      ? getPositionTakeProfitSteps(position, paperTradeSettings)
      : normalizeTakeProfitSteps(paperTradeSettings.takeProfitSteps);

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
      paperTargetPositionSizeUsd:
        position?.target_position_size_usd ?? position?.position_size_usd ?? null,
      paperTokenAmount: position?.token_amount ?? null,
      paperEntryPrice: position?.entry_price ?? null,
      paperCurrentPrice: position?.current_price ?? null,
      paperPnLPct: position?.pnl_pct ?? null,
      paperRealizedPnLUsd: position?.realized_pnl_usd ?? 0,
      paperOpenedAt: position?.opened_at ? new Date(position.opened_at * 1000).toISOString() : null,
      paperClosedAt: position?.closed_at ? new Date(position.closed_at * 1000).toISOString() : null,
      paperCloseReason: position?.close_reason || '',
      paperTakeProfitPct:
        position?.take_profit_pct ?? takeProfitSteps[0]?.targetPercent ?? LEGACY_PAPER_TAKE_PROFIT_PERCENT,
      paperTakeProfitSteps: takeProfitSteps,
      paperTpStage: position?.tp_stage ?? 0,
      paperStopLossPct: position?.stop_loss_pct ?? paperTradeSettings.stopLossPercent,
      paperEntryStage: position?.entry_stage ?? PAPER_ENTRY_STAGE_ALLOCATIONS.length,
    };
  });
}

function getRecentPersistedAlerts(db, limit = 50) {
  const fetchLimit = Math.min(Math.max(limit * 20, 200), 2_000);
  const rows = db.prepare(`
    SELECT
      alerts.chain,
      alerts.address,
      alerts.signal_count,
      alerts.name,
      alerts.symbol,
      alerts.image_url,
      alerts.price,
      alerts.mc,
      alerts.liq,
      alerts.volume,
      alerts.smart_money,
      alerts.holders,
      alerts.buy_sell_ratio,
      alerts.age_hours,
      alerts.change_1h,
      alerts.pct_gain,
      alerts.stars,
      alerts.narrative_tag,
      alerts.category,
      alerts.twitter,
      alerts.telegram,
      alerts.website,
      alerts.message,
      alerts.pushed_at,
      intents.trade_score
    FROM pushed_alerts AS alerts
    LEFT JOIN trade_intents AS intents
      ON intents.chain = alerts.chain
     AND intents.address = alerts.address
     AND intents.signal_count = alerts.signal_count
    ORDER BY alerts.pushed_at DESC, alerts.id DESC
    LIMIT ?
  `).all(fetchLimit);

  const groups = new Map();
  let latestSignal = null;

  for (const row of rows) {
    const key = `${row.chain}:${row.address}`;
    const pushedAt = new Date(row.pushed_at * 1000).toISOString();
    const historyItem = {
      signalCount: row.signal_count,
      pushedAt,
      pctGain: row.pct_gain,
      price: row.price,
      tradeScore: row.trade_score,
    };

    if (!latestSignal) {
      latestSignal = {
        chain: row.chain,
        address: row.address,
        signalCount: row.signal_count,
        name: row.name,
        symbol: row.symbol,
        imageUrl: row.image_url || '',
        price: row.price,
        pushedAt,
        pctGain: row.pct_gain,
        smartMoney: row.smart_money,
        tradeScore: row.trade_score,
        narrativeTag: row.narrative_tag,
        category: row.category,
        twitter: row.twitter || '',
        telegram: row.telegram || '',
        website: row.website || '',
      };
    }

    if (!groups.has(key)) {
      if (groups.size >= limit) {
        continue;
      }

      groups.set(key, {
        address: row.address,
        name: row.name,
        symbol: row.symbol,
        imageUrl: row.image_url || '',
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

  return {
    alerts: enrichAlertsWithTradeState(db, groupedAlerts),
    latestSignal,
  };
}

function getSignalTimeline(db, maxPoints = 1500) {
  const safeLimit = Number.isFinite(maxPoints) ? Math.min(Math.max(maxPoints, 100), 5_000) : 1500;
  const rows = db.prepare(`
    SELECT name, symbol, address, image_url, price, signal_count, pushed_at
    FROM pushed_alerts
    ORDER BY pushed_at ASC, id ASC
    LIMIT ?
  `).all(safeLimit);

  return rows.map((row, index) => ({
    time: new Date(row.pushed_at * 1000).toISOString(),
    signalCount: row.signal_count,
    cumulativeCount: index + 1,
    name: row.name,
    symbol: row.symbol,
    imageUrl: row.image_url || '',
    address: row.address,
    price: row.price,
  }));
}

function createEmptyRadarSnapshot(limit = 60, options = {}) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 120) : 60;
  const strategyRuntimeInfo = getStrategyRuntimeInfoFromStartedAt(options.strategyStartedAt || null);
  const paperTradeSettings = normalizePaperTradeSettings(
    options.paperTradeSettings || getRadarConfig().paperTradeSettings
  );

  return {
    pushed: 0,
    found: 0,
    scanned: 0,
    scannedAt: options.scannedAt || null,
    persistedThisRound: 0,
    totalPersisted: 0,
    totalPersistedTokens: 0,
    latestSignal: null,
    paperSummary: getPaperAccountSummaryFromPositions([]),
    paperPositions: [],
    closedPaperPositions: [],
    summary: {
      triggered: 0,
      ready: 0,
      watching: 0,
      scanning: 0,
    },
    alerts: [],
    signalTimeline: [],
    rows: [],
    config: {
      ...getRadarConfig(),
      paperTakeProfitPercent:
        paperTradeSettings.takeProfitSteps[0]?.targetPercent || LEGACY_PAPER_TAKE_PROFIT_PERCENT,
      paperTakeProfitSteps: paperTradeSettings.takeProfitSteps,
      paperStopLossPercent: paperTradeSettings.stopLossPercent,
      paperTradeSettings,
    },
    rowLimit: safeLimit,
    ...strategyRuntimeInfo,
  };
}

export async function getPersistedRadarSnapshot(limit = 60) {
  if (supabaseStorageEnabled()) {
    const supabaseSnapshot = await getSupabasePersistedSignalSnapshot(limit);
    if (supabaseSnapshot) {
      return supabaseSnapshot;
    }

    return createEmptyRadarSnapshot(limit, {
      paperTradeSettings: await getStoredPaperTradeSettings(),
    });
  }

  const db = initDb();
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 120) : 60;
  const { alerts, latestSignal } = getRecentPersistedAlerts(db, safeLimit);
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
  const signalTimeline = getSignalTimeline(db);
  const config = getRadarConfig(db);
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
    latestSignal: latestSignal || alerts[0] || null,
    signalTimeline,
    rows: [],
    config,
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

  const remainingTokenAmount = Number(position.remainingTokenAmount ?? position.tokenAmount ?? 0);
  const remainingPositionSizeUsd = Number(
    position.remainingPositionSizeUsd ?? position.positionSizeUsd ?? 0
  );
  const realizedPnlUsd = Number(position.realizedPnlUsd || 0);
  const currentValueUsd = roundTo(mulBn(remainingTokenAmount, livePrice), 2);
  const pnlUsd = roundTo(addBn(realizedPnlUsd, subBn(currentValueUsd, remainingPositionSizeUsd)), 2);
  const pnlPct =
    position.positionSizeUsd > 0
      ? roundTo(mulBn(divBn(pnlUsd, position.positionSizeUsd), 100), 2)
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
  const closedCostUsd = Number(baseSummary?.closedCostUsd || 0);
  const closedSellUsd = Number(baseSummary?.closedValueUsd || 0);
  const closedPnLUsd = Number(baseSummary?.closedPnLUsd || 0);
  const openCostUsd = sumBn(liveOpenPositions.map((position) => position.remainingPositionSizeUsd || 0));
  const openOriginalCostUsd = sumBn(liveOpenPositions.map((position) => position.positionSizeUsd || 0));
  const openValueUsd = sumBn(liveOpenPositions.map((position) => position.currentValueUsd || 0));
  const openRealizedProceedsUsd = sumBn(
    liveOpenPositions.map((position) => position.realizedProceedsUsd || 0)
  );
  const openPnLUsd = addBn(
    sumBn(liveOpenPositions.map((position) => position.realizedPnlUsd || 0)),
    subBn(openValueUsd, openCostUsd)
  );
  const cashBalanceUsd = addBn(
    subBn(totalCapitalUsd, addBn(closedCostUsd, openOriginalCostUsd)),
    closedSellUsd,
    openRealizedProceedsUsd
  );
  const equityUsd = addBn(cashBalanceUsd, openValueUsd);
  const totalPnLUsd = addBn(closedPnLUsd, openPnLUsd);
  const capitalUsagePct =
    totalCapitalUsd > 0 ? roundTo(mulBn(divBn(openCostUsd, totalCapitalUsd), 100), 2) : 0;

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
  const snapshot = await getPersistedRadarSnapshot(limit);
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

function applyRuntimeStateMaps(runtimeState) {
  MOMENTUM_TRACKER.clear();
  MOMENTUM_PUSHED.clear();
  TOKENS_SEEN_RUNTIME.clear();
  NARRATIVES_RUNTIME.clear();

  if (!runtimeState) {
    return;
  }

  for (const [address, snapshots] of runtimeState.momentumTracker.entries()) {
    MOMENTUM_TRACKER.set(address, snapshots);
  }
  for (const [address, info] of runtimeState.momentumPushed.entries()) {
    MOMENTUM_PUSHED.set(address, info);
  }
  for (const [address, tokenState] of runtimeState.tokensSeen.entries()) {
    TOKENS_SEEN_RUNTIME.set(address, tokenState);
  }
  for (const [theme, narrativeState] of runtimeState.narratives.entries()) {
    NARRATIVES_RUNTIME.set(theme, narrativeState);
  }
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

function isTokenSeen(db, address, runtimeState = null) {
  if (runtimeState) {
    return runtimeState.tokensSeen.has(address);
  }

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
  pushed = false,
  runtimeState = null
) {
  if (runtimeState) {
    const now = Math.floor(Date.now() / 1000);
    const existing = runtimeState.tokensSeen.get(address);
    if (existing) {
      runtimeState.tokensSeen.set(address, {
        ...existing,
        seenCount: (existing.seenCount || 0) + 1,
        marketCap,
        category,
        updatedAt: now,
      });
      TOKENS_SEEN_RUNTIME.set(address, runtimeState.tokensSeen.get(address));
      return;
    }

    const payload = {
      address,
      chain,
      name,
      symbol,
      theme,
      category,
      firstSeenAt: now,
      marketCap,
      pushed: Boolean(pushed),
      seenCount: 1,
      updatedAt: now,
    };
    runtimeState.tokensSeen.set(address, payload);
    TOKENS_SEEN_RUNTIME.set(address, payload);
    return;
  }

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

function checkNarrativeNovelty(db, theme, name, address, chain, runtimeState = null) {
  const now = Math.floor(Date.now() / 1000);
  const heatWindow = 1800;
  const heatThreshold = 2;

  if (runtimeState) {
    const exact = runtimeState.narratives.get(theme);
    if (exact) {
      const updated = {
        ...exact,
        tokenCount: (exact.tokenCount || 0) + 1,
        lastSeenAt: now,
      };
      runtimeState.narratives.set(theme, updated);
      NARRATIVES_RUNTIME.set(theme, updated);

      if (
        (now - updated.firstSeenAt < heatWindow && updated.tokenCount >= heatThreshold) ||
        (now - Number(exact.lastSeenAt || 0) < heatWindow && updated.tokenCount >= heatThreshold)
      ) {
        return ['heating', updated];
      }

      return ['existing', updated];
    }

    const recentThemes = [...runtimeState.narratives.values()]
      .sort((left, right) => Number(right.lastSeenAt || 0) - Number(left.lastSeenAt || 0))
      .slice(0, 1000);

    for (const row of recentThemes) {
      if (!isSimilarTheme(theme, row.theme)) {
        continue;
      }

      const updated = {
        ...row,
        tokenCount: (row.tokenCount || 0) + 1,
        lastSeenAt: now,
      };
      runtimeState.narratives.delete(row.theme);
      runtimeState.narratives.set(row.theme, updated);
      NARRATIVES_RUNTIME.set(row.theme, updated);

      if (now - Number(row.lastSeenAt || 0) < heatWindow && updated.tokenCount >= heatThreshold) {
        return ['heating', updated];
      }

      return ['existing', updated];
    }

    const payload = {
      theme,
      firstTokenName: name,
      firstTokenAddress: address,
      firstChain: chain,
      firstSeenAt: now,
      tokenCount: 1,
      lastSeenAt: now,
    };
    runtimeState.narratives.set(theme, payload);
    NARRATIVES_RUNTIME.set(theme, payload);
    return ['novel', null];
  }

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
  let lastReason = 'unknown error';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const json = await fetchJson(url, { headers: GMGN_HEADERS });
      return json.data || {};
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
      if (attempt < 3) {
        await sleep(400 * attempt);
      }
    }
  }

  throw new Error(`GMGN 请求失败(重试3次): ${lastReason}`);
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
    imageUrl:
      token.logo ||
      token.logo_uri ||
      token.logoURI ||
      token.image ||
      token.image_uri ||
      token.imageUrl ||
      token.icon ||
      token.icon_url ||
      '',
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
  const requestErrors = [];

  for (const chain of chains) {
    const urls = [
      `https://gmgn.ai/defi/quotation/v1/rank/${chain}/swaps/1h?orderby=open_timestamp&direction=desc&limit=100`,
      `https://gmgn.ai/defi/quotation/v1/rank/${chain}/swaps/1h?orderby=swaps&direction=desc&limit=50`,
    ];

    for (const url of urls) {
      let data;
      try {
        data = await gmgnGet(url);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        requestErrors.push(`${url} -> ${reason}`);
        continue;
      }
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

  if (allTokens.length === 0 && requestErrors.length > 0) {
    log('[GMGN] 候选币列表获取失败，当前返回 0 个候选币。');
    for (const error of requestErrors.slice(0, 3)) {
      log(`[GMGN] ${error}`);
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
  const gmgnUrl = getGmgnTokenUrl(token.chain, token.address);
  const tradeScore = getTradeScore({ token, signalCount: seenCount }).score;
  const priceActionScore = getPriceActionScore(token, pctGain, rounds, volUp);
  const priceText = formatCompactPrice(token.price);

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
  message += `价格: [$${priceText}](${gmgnUrl})\n`;
  message += `交易评分: ${tradeScore}/100\n`;
  message += `价格评分: ${priceActionScore.score}/100 (${priceActionScore.label})\n\n`;
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

function syncOpenPaperPositionSettings(db, settings) {
  const normalized = normalizePaperTradeSettings(settings);
  db.prepare(`
    UPDATE paper_positions
    SET stop_loss_pct = ?, take_profit_pct = ?, tp_plan_json = ?
    WHERE status = ?
  `).run(
    normalized.stopLossPercent,
    normalized.takeProfitSteps[0]?.targetPercent || LEGACY_PAPER_TAKE_PROFIT_PERCENT,
    JSON.stringify(normalized.takeProfitSteps),
    'open'
  );
}

export async function getStoredPaperTradeSettings() {
  if (supabaseStorageEnabled()) {
    const remoteSettings = await getSupabasePaperTradeSettings();
    return normalizePaperTradeSettings(remoteSettings || {});
  }

  const db = initDb();
  const settings = getPaperTradeSettings(db);
  db.close();
  return settings;
}

export async function getPaperTradeSettingsLockState() {
  if (supabaseStorageEnabled()) {
    const summary = await getSupabasePaperTradeSummary();
    const openCount = Number(summary?.openCount || 0);
    return {
      locked: openCount > 0,
      openCount,
    };
  }

  const db = initDb();
  const openCount = Number(getOpenPaperPositionCount(db) || 0);
  db.close();
  return {
    locked: openCount > 0,
    openCount,
  };
}

export async function updateStoredPaperTradeSettings(settings, options = {}) {
  if (supabaseStorageEnabled()) {
    const remoteSettings = await updateSupabasePaperTradeSettings(
      normalizePaperTradeSettings(settings),
      options
    );
    return normalizePaperTradeSettings(remoteSettings || settings);
  }

  const db = initDb();
  const nextSettings = setPaperTradeSettings(db, settings);
  if (options.applyToOpenPositions) {
    syncOpenPaperPositionSettings(db, nextSettings);
  }
  db.close();
  return nextSettings;
}

export function getRadarConfig(db = null) {
  const paperTradeSettings = db ? getPaperTradeSettings(db) : normalizePaperTradeSettings();
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
    tradeHeadEntrySignalCount: TRADE_HEAD_ENTRY_SIGNAL_COUNT,
    tradeMinLiquidity: TRADE_MIN_LIQUIDITY,
    tradeMinVolume: TRADE_MIN_VOLUME,
    tradeMinBuySellRatio: TRADE_MIN_BUY_SELL_RATIO,
    tradeMaxTokenAgeHours: TRADE_MAX_TOKEN_AGE_HOURS,
    tradeHotModeChange1h: TRADE_HOT_MODE_CHANGE_1H,
    tradeHotModeMinSmartMoney: TRADE_HOT_MODE_MIN_SMART_MONEY,
    tradeHotModeMinLiquidity: TRADE_HOT_MODE_MIN_LIQUIDITY,
    tradeHotModeMinBuySellRatio: TRADE_HOT_MODE_MIN_BUY_SELL_RATIO,
    tradeHotModeMinScore: TRADE_HOT_MODE_MIN_SCORE,
    tradeSecondHeadMinScore: TRADE_SECOND_HEAD_MIN_SCORE,
    tradeSecondHeadMinScoreDelta: TRADE_SECOND_HEAD_MIN_SCORE_DELTA,
    paperTakeProfitPercent:
      paperTradeSettings.takeProfitSteps[0]?.targetPercent || LEGACY_PAPER_TAKE_PROFIT_PERCENT,
    paperTakeProfitSteps: paperTradeSettings.takeProfitSteps,
    paperStopLossPercent: paperTradeSettings.stopLossPercent,
    paperTrailingStartPercent: paperTradeSettings.trailingStartPercent,
    paperTrailingStopPercent: paperTradeSettings.trailingStopPercent,
    paperTimeStopHours: paperTradeSettings.timeStopHours,
    paperPolicyLabel: formatPaperTradePolicyLabel(paperTradeSettings),
    paperTradeSettings,
    paperBasePositionUsd: PAPER_BASE_POSITION_USD,
    paperTotalCapitalUsd: PAPER_TOTAL_CAPITAL_USD,
    paperMaxOpenPositions: PAPER_MAX_OPEN_POSITIONS,
    paperMaxCapitalUsagePct: PAPER_MAX_CAPITAL_USAGE_PCT,
    paperMaxSinglePositionPct: PAPER_MAX_SINGLE_POSITION_PCT,
    paperEntryStageAllocations: PAPER_ENTRY_STAGE_ALLOCATIONS,
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
  const useSupabase = supabaseStorageEnabled();
  const runtimeState = useSupabase
    ? (await loadSupabaseRuntimeState()) || {
        momentumTracker: new Map(),
        momentumPushed: new Map(),
        tokensSeen: new Map(),
        narratives: new Map(),
        paperPositions: new Map(),
      }
    : null;

  if (useSupabase) {
    applyRuntimeStateMaps(runtimeState);
  }

  const previousSnapshot = useSupabase
    ? await getSupabasePersistedSignalSnapshot(Math.max(rowLimit, 120))
    : null;
  const db = useSupabase ? null : initDb();
  let remotePaperTradeSettings = normalizePaperTradeSettings();
  if (useSupabase) {
    const remoteSettings = await getSupabasePaperTradeSettings();
    if (remoteSettings) {
      remotePaperTradeSettings = normalizePaperTradeSettings(remoteSettings);
    }
  } else {
    ensureStrategySessionMeta(db);
  }
  const tokens = await fetchNewTokens();
  const scannedAt = new Date().toISOString();
  const scannedAtTs = Math.floor(Date.now() / 1000);
  log(`扫描 ${tokens.length} 个候选币...`);

  const allMomentumTokens = [...tokens];
  const momentumAlerts = await trackMomentum(allMomentumTokens);
  const dashboardRows = buildDashboardRows(tokens, momentumAlerts).slice(0, rowLimit);

  for (const token of tokens) {
    if (isTokenSeen(db, token.address, runtimeState)) {
      const theme = normalizeTheme(token.name, token.symbol);
      recordToken(
        db,
        token.address,
        token.chain,
        token.name,
        token.symbol,
        theme,
        classifyNarrative(token.name, token.symbol, token.chain)[0],
        token.mc,
        false,
        runtimeState
      );
      if (theme && runtimeState?.narratives.has(theme)) {
        const narrative = runtimeState.narratives.get(theme);
        const updated = {
          ...narrative,
          tokenCount: Number(narrative.tokenCount || 0) + 1,
          lastSeenAt: Math.floor(Date.now() / 1000),
        };
        runtimeState.narratives.set(theme, updated);
        NARRATIVES_RUNTIME.set(theme, updated);
      }
      continue;
    }

    const [category] = classifyNarrative(token.name, token.symbol, token.chain);
    if (category === 'spam') {
      recordToken(
        db,
        token.address,
        token.chain,
        token.name,
        token.symbol,
        '',
        'spam',
        token.mc,
        false,
        runtimeState
      );
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
        token.mc,
        false,
        runtimeState
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
      token.mc,
      false,
      runtimeState
    );
    checkNarrativeNovelty(db, theme, token.name, token.address, token.chain, runtimeState);
  }

  const currentAlerts = [...momentumAlerts]
    .sort(compareSignalPriority)
    .slice(0, MAX_ALERTS_PER_ROUND);
  let persistedThisRound = 0;
  let persistedAlerts = [];
  let totalPersisted = 0;
  let totalPersistedTokens = 0;
  let lastScannedAt = scannedAt;
  let paperSummary;
  let paperPositions;
  let closedPaperPositions;
  let latestSignal = currentAlerts[0] || null;
  let signalTimeline = [];
  let config;
  let strategyRuntimeInfo;

  if (useSupabase) {
    const startedAt = previousSnapshot?.strategyStartedAt || scannedAt;
    strategyRuntimeInfo = getStrategyRuntimeInfoFromStartedAt(startedAt);
    const runtimePaperPositions = normalizeRuntimePaperPositions(runtimeState?.paperPositions);
    const historyScoreMap = buildHistoryScoreMapFromAlerts(previousSnapshot?.alerts);
    const nextPaperPositions = processTradePlansInMemory(
      runtimePaperPositions,
      currentAlerts,
      tokens,
      scannedAtTs,
      remotePaperTradeSettings,
      historyScoreMap
    );
    paperSummary = getPaperAccountSummaryFromPositions(nextPaperPositions);
    paperPositions = nextPaperPositions
      .filter((position) => position.status === 'open')
      .sort(
        (left, right) =>
          new Date(right.updatedAt || right.openedAt || 0).getTime() -
          new Date(left.updatedAt || left.openedAt || 0).getTime()
      )
      .slice(0, 20);
    closedPaperPositions = nextPaperPositions
      .filter((position) => position.status === 'closed')
      .sort(
        (left, right) =>
          new Date(right.updatedAt || right.openedAt || 0).getTime() -
          new Date(left.updatedAt || left.openedAt || 0).getTime()
      )
      .slice(0, 30);
    persistedThisRound = currentAlerts.length;
    latestSignal = currentAlerts[0] || null;
    config = {
      ...getRadarConfig(),
      paperTakeProfitPercent:
        remotePaperTradeSettings.takeProfitSteps[0]?.targetPercent ||
        LEGACY_PAPER_TAKE_PROFIT_PERCENT,
      paperTakeProfitSteps: remotePaperTradeSettings.takeProfitSteps,
      paperStopLossPercent: remotePaperTradeSettings.stopLossPercent,
      paperTradeSettings: remotePaperTradeSettings,
    };
  } else {
    setRadarMeta(db, 'last_scanned_at', scannedAt);
    setRadarMeta(db, 'last_scanned_at_ts', scannedAtTs);
    processTradePlans(db, currentAlerts, tokens, scannedAtTs);
    persistedThisRound = persistAlerts(db, currentAlerts, scannedAtTs);
    const persistedResult = getRecentPersistedAlerts(db, rowLimit);
    persistedAlerts = persistedResult.alerts;
    latestSignal = persistedResult.latestSignal || currentAlerts[0] || null;
    totalPersisted = db.prepare('SELECT COUNT(*) AS count FROM pushed_alerts').get().count || 0;
    totalPersistedTokens =
      db.prepare("SELECT COUNT(DISTINCT chain || ':' || address) AS count FROM pushed_alerts").get()
        .count || 0;
    lastScannedAt = getRadarMeta(db, 'last_scanned_at', scannedAt);
    paperSummary = getPaperTradeSummary(db);
    paperPositions = getPaperPositions(db, 'open', 20);
    closedPaperPositions = getPaperPositions(db, 'closed', 30);
    signalTimeline = getSignalTimeline(db);
    config = getRadarConfig(db);
    strategyRuntimeInfo = getStrategyRuntimeInfo(db);
  }

  let pushed = 0;
  if (deliver) {
    for (const alert of currentAlerts) {
      if (await tgSend(alert.msg)) {
        pushed += 1;
        await sleep(1_000);
      }
    }
  }

  const result = {
    pushed,
    found: currentAlerts.length,
    scanned: tokens.length,
    scannedAt: lastScannedAt,
    persistedThisRound,
    totalPersisted,
    totalPersistedTokens,
    latestSignal: latestSignal
      ? {
          chain: latestSignal.chain,
          address: latestSignal.address,
          signalCount: latestSignal.signalCount || 1,
          name: latestSignal.name,
          symbol: latestSignal.symbol,
          imageUrl: latestSignal.imageUrl || '',
          price: latestSignal.price || 0,
          pushedAt: latestSignal.pushedAt || scannedAt,
          pctGain: latestSignal.pctGain || 0,
          smartMoney: latestSignal.smartMoney || 0,
          tradeScore: latestSignal.tradeScore ?? null,
          narrativeTag: latestSignal.narrativeTag || '',
          category: latestSignal.category || '',
          twitter: latestSignal.twitter || '',
          telegram: latestSignal.telegram || '',
          website: latestSignal.website || '',
        }
      : null,
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
    latestSignal,
    signalTimeline,
    rows: dashboardRows,
    config,
    ...strategyRuntimeInfo,
  };

  if (useSupabase) {
    await syncSupabaseSignalSnapshot({
      snapshot: result,
      currentAlerts,
      scannedAtTs,
      momentumTracker: MOMENTUM_TRACKER,
      momentumPushed: MOMENTUM_PUSHED,
      tokensSeen: runtimeState?.tokensSeen || TOKENS_SEEN_RUNTIME,
      narratives: runtimeState?.narratives || NARRATIVES_RUNTIME,
      paperPositionsState: [...paperPositions, ...closedPaperPositions],
    });

    const [
      syncedAlerts,
      syncedTimeline,
      syncedPaperSummary,
      syncedOpenPositions,
      syncedClosedPositions,
      syncedAlertStats,
    ] = await Promise.all([
      getSupabasePersistedAlerts(rowLimit),
      getSupabaseSignalTimeline(),
      getSupabasePaperTradeSummary(),
      getSupabasePaperPositions('open', 20),
      getSupabasePaperPositions('closed', 30),
      getSupabaseAlertStats(),
    ]);

    result.alerts = syncedAlerts;
    result.latestSignal = syncedAlerts[0] || result.latestSignal;
    result.signalTimeline = syncedTimeline;
    result.paperSummary = syncedPaperSummary || result.paperSummary;
    result.paperPositions = syncedOpenPositions;
    result.closedPaperPositions = syncedClosedPositions;
    result.totalPersisted = syncedAlertStats.totalPersisted || result.totalPersisted;
    result.totalPersistedTokens =
      syncedAlertStats.totalPersistedTokens || result.totalPersistedTokens;
    result.scannedAt = scannedAt;
  }

  if (db) {
    db.close();
  }
  return result;
}

async function main() {
  let startupTradeSettings;
  if (supabaseStorageEnabled()) {
    const runtimeState =
      (await loadSupabaseRuntimeState()) || {
        momentumTracker: new Map(),
        momentumPushed: new Map(),
        tokensSeen: new Map(),
        narratives: new Map(),
      };
    applyRuntimeStateMaps(runtimeState);
    startupTradeSettings = await getStoredPaperTradeSettings();
  } else {
    const db = initDb();
    ensureStrategySessionMeta(db, { reset: true });
    startupTradeSettings = getPaperTradeSettings(db);
    db.close();
  }

  log('='.repeat(50));
  log('链上雷达 Node.js 版启动');
  log(`扫描间隔: ${SCAN_INTERVAL}s`);
  log('推送逻辑: 动量优先 — 连涨才推，叙事只做分类标签');
  log(
    `核心规则: 30秒仅扫描SOL，连涨3轮且涨幅>=5%，聪明钱>=${MIN_SMART_DEGEN_COUNT}，流动性>=${PUSH_MIN_LIQUIDITY}，持有人>=${PUSH_MIN_HOLDERS}，1h量>=${PUSH_MIN_VOLUME}，买卖比>=${PUSH_MIN_BUY_SELL_RATIO}`
  );
  log(
    `交易风控: score>=${TRADE_SCORE_THRESHOLD}，仅第1次信号，最多${PAPER_MAX_OPEN_POSITIONS}个持仓，资金使用率<=${PAPER_MAX_CAPITAL_USAGE_PCT}%，基础仓位${PAPER_BASE_POSITION_USD} USD，${formatPaperTradePolicyLabel(startupTradeSettings)}`
  );
  log('='.repeat(50));

  await tgSend(
    '链上雷达 Node.js 版已启动\n\n' +
      '核心逻辑: 动量优先\n' +
      `连涨3轮+涨幅>=5%且聪明钱>=${MIN_SMART_DEGEN_COUNT}才推送\n` +
      '扫描范围: 仅SOL\n' +
      `质量门槛: 流动性>=${PUSH_MIN_LIQUIDITY} | 持有人>=${PUSH_MIN_HOLDERS} | 1h量>=${PUSH_MIN_VOLUME} | 买卖比>=${PUSH_MIN_BUY_SELL_RATIO}\n` +
      `交易风控: score>=${TRADE_SCORE_THRESHOLD} | 仅第1次信号 | 最多${PAPER_MAX_OPEN_POSITIONS}仓 | 资金使用率<=${PAPER_MAX_CAPITAL_USAGE_PCT}% | 基础仓位${PAPER_BASE_POSITION_USD} USD | ${formatPaperTradePolicyLabel(startupTradeSettings)}\n` +
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

export {
  scanNarratives as scanSignals,
  getPersistedRadarSnapshot as getPersistedSignalSnapshot,
  getRealtimeRadarSnapshot as getRealtimeSignalSnapshot,
  getRadarConfig as getSignalScanConfig,
};
