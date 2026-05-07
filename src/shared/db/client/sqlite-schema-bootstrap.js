export function ensureLocalSqliteSchema(db, { backfillPaperPositionState } = {}) {
  db.exec(LOCAL_SIGNAL_SCHEMA_SQL);
  migratePushedAlerts(db);
  migrateTradeIntents(db);
  migratePaperPositions(db);
  backfillPaperPositionState?.(db);
}

function migratePushedAlerts(db) {
  const alertColumns = db.prepare('PRAGMA table_info(pushed_alerts)').all();
  const columnNames = new Set(alertColumns.map((column) => column.name));
  if (!columnNames.has('image_url')) db.exec('ALTER TABLE pushed_alerts ADD COLUMN image_url TEXT');
  if (!columnNames.has('price')) db.exec('ALTER TABLE pushed_alerts ADD COLUMN price REAL');
}

function migratePaperPositions(db) {
  const positionColumns = db.prepare('PRAGMA table_info(paper_positions)').all();
  const positionColumnNames = new Set(positionColumns.map((column) => column.name));
  const addColumn = (name, ddl) => {
    if (!positionColumnNames.has(name)) db.exec(`ALTER TABLE paper_positions ADD COLUMN ${ddl}`);
  };

  addColumn('image_url', 'image_url TEXT');
  addColumn('position_size_usd', 'position_size_usd REAL');
  addColumn('token_amount', 'token_amount REAL');
  addColumn('target_position_size_usd', 'target_position_size_usd REAL');
  addColumn('remaining_token_amount', 'remaining_token_amount REAL');
  addColumn('remaining_position_size_usd', 'remaining_position_size_usd REAL');
  addColumn('realized_pnl_usd', 'realized_pnl_usd REAL DEFAULT 0');
  addColumn('realized_proceeds_usd', 'realized_proceeds_usd REAL DEFAULT 0');
  addColumn('tp_stage', 'tp_stage INTEGER DEFAULT 0');
  addColumn('tp_plan_json', 'tp_plan_json TEXT');
  addColumn('peak_price', 'peak_price REAL');
  addColumn('entry_stage', 'entry_stage INTEGER DEFAULT 3');
  addColumn('peak_pnl_pct', 'peak_pnl_pct REAL DEFAULT 0');
}

function migrateTradeIntents(db) {
  const tradeIntentColumns = db.prepare('PRAGMA table_info(trade_intents)').all();
  const tradeIntentColumnNames = new Set(tradeIntentColumns.map((column) => column.name));
  if (!tradeIntentColumnNames.has('price_score')) {
    db.exec('ALTER TABLE trade_intents ADD COLUMN price_score INTEGER');
  }
  if (!tradeIntentColumnNames.has('rounds')) {
    db.exec('ALTER TABLE trade_intents ADD COLUMN rounds INTEGER');
  }
}

const LOCAL_SIGNAL_SCHEMA_SQL = `
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

  CREATE TABLE IF NOT EXISTS radar_meta (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE IF NOT EXISTS trade_intents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain TEXT NOT NULL,
    address TEXT NOT NULL,
    signal_count INTEGER NOT NULL,
    name TEXT,
    symbol TEXT,
    trade_score INTEGER,
    price_score INTEGER,
    rounds INTEGER,
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
`;
