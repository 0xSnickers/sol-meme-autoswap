import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const sqliteNarratives = sqliteTable(
  'narratives',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    theme: text('theme').notNull(),
    firstTokenName: text('first_token_name'),
    firstTokenAddress: text('first_token_address'),
    firstChain: text('first_chain'),
    firstSeenAt: integer('first_seen_at'),
    tokenCount: integer('token_count').default(1),
    lastSeenAt: integer('last_seen_at'),
  },
  (table) => ({
    themeIdx: index('idx_theme').on(table.theme),
  })
);

export const sqliteTokensSeen = sqliteTable(
  'tokens_seen',
  {
    address: text('address').primaryKey(),
    chain: text('chain'),
    name: text('name'),
    symbol: text('symbol'),
    narrativeTheme: text('narrative_theme'),
    category: text('category'),
    firstSeenAt: integer('first_seen_at'),
    marketCap: real('market_cap'),
    pushed: integer('pushed').default(0),
    seenCount: integer('seen_count').default(1),
  },
  (table) => ({
    addressIdx: index('idx_addr').on(table.address),
  })
);

export const sqliteRadarMeta = sqliteTable('radar_meta', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const sqlitePushedAlerts = sqliteTable(
  'pushed_alerts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    chain: text('chain').notNull(),
    address: text('address').notNull(),
    signalCount: integer('signal_count').notNull().default(1),
    name: text('name'),
    symbol: text('symbol'),
    imageUrl: text('image_url'),
    price: real('price'),
    mc: real('mc'),
    liq: real('liq'),
    volume: real('volume'),
    smartMoney: integer('smart_money'),
    holders: integer('holders'),
    buySellRatio: real('buy_sell_ratio'),
    ageHours: real('age_hours'),
    change1h: real('change_1h'),
    pctGain: real('pct_gain'),
    stars: integer('stars'),
    narrativeTag: text('narrative_tag'),
    category: text('category'),
    twitter: text('twitter'),
    telegram: text('telegram'),
    website: text('website'),
    message: text('message'),
    pushedAt: integer('pushed_at').notNull(),
  },
  (table) => ({
    uniqueSignalIdx: uniqueIndex('sqlite_pushed_alerts_unique_signal').on(
      table.chain,
      table.address,
      table.signalCount
    ),
    pushedAtIdx: index('idx_pushed_alerts_time').on(table.pushedAt),
  })
);

export const sqliteTradeIntents = sqliteTable(
  'trade_intents',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    chain: text('chain').notNull(),
    address: text('address').notNull(),
    signalCount: integer('signal_count').notNull(),
    name: text('name'),
    symbol: text('symbol'),
    tradeScore: integer('trade_score'),
    priceScore: integer('price_score'),
    rounds: integer('rounds'),
    status: text('status').notNull(),
    decisionReason: text('decision_reason'),
    smartMoney: integer('smart_money'),
    buySellRatio: real('buy_sell_ratio'),
    liquidity: real('liquidity'),
    volume: real('volume'),
    price: real('price'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    uniqueSignalIdx: uniqueIndex('sqlite_trade_intents_unique_signal').on(
      table.chain,
      table.address,
      table.signalCount
    ),
    createdAtIdx: index('idx_trade_intents_time').on(table.createdAt),
  })
);

export const sqlitePaperPositions = sqliteTable(
  'paper_positions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    chain: text('chain').notNull(),
    address: text('address').notNull(),
    name: text('name'),
    symbol: text('symbol'),
    imageUrl: text('image_url'),
    entrySignalCount: integer('entry_signal_count').notNull(),
    tradeScore: integer('trade_score'),
    positionSizeUsd: real('position_size_usd'),
    targetPositionSizeUsd: real('target_position_size_usd'),
    tokenAmount: real('token_amount'),
    remainingTokenAmount: real('remaining_token_amount'),
    remainingPositionSizeUsd: real('remaining_position_size_usd'),
    realizedPnlUsd: real('realized_pnl_usd').default(0),
    realizedProceedsUsd: real('realized_proceeds_usd').default(0),
    tpStage: integer('tp_stage').default(0),
    tpPlanJson: text('tp_plan_json'),
    entryPrice: real('entry_price').notNull(),
    currentPrice: real('current_price'),
    takeProfitPct: real('take_profit_pct').notNull(),
    stopLossPct: real('stop_loss_pct').notNull(),
    status: text('status').notNull(),
    openedAt: integer('opened_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    closedAt: integer('closed_at'),
    closePrice: real('close_price'),
    closeReason: text('close_reason'),
    pnlPct: real('pnl_pct').default(0),
    smartMoney: integer('smart_money'),
    buySellRatio: real('buy_sell_ratio'),
    liquidity: real('liquidity'),
    volume: real('volume'),
    entryStage: integer('entry_stage').default(3),
    peakPrice: real('peak_price'),
    peakPnlPct: real('peak_pnl_pct').default(0),
  },
  (table) => ({
    uniqueSignalIdx: uniqueIndex('sqlite_paper_positions_unique_signal').on(
      table.chain,
      table.address,
      table.entrySignalCount
    ),
    statusUpdatedIdx: index('idx_paper_positions_status').on(table.status, table.updatedAt),
  })
);
