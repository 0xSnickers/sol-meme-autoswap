import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const postgresRadarMeta = pgTable('radar_meta', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const postgresRadarNarratives = pgTable(
  'radar_narratives',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    theme: text('theme').notNull(),
    firstTokenName: text('first_token_name'),
    firstTokenAddress: text('first_token_address'),
    firstChain: text('first_chain'),
    firstSeenAt: bigint('first_seen_at', { mode: 'number' }),
    tokenCount: integer('token_count').default(1),
    lastSeenAt: bigint('last_seen_at', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    themeIdx: index('idx_radar_narratives_theme').on(table.theme),
    lastSeenAtIdx: index('idx_radar_narratives_last_seen_at').on(table.lastSeenAt),
  })
);

export const postgresRadarTokensSeen = pgTable(
  'radar_tokens_seen',
  {
    address: text('address').primaryKey(),
    chain: text('chain'),
    name: text('name'),
    symbol: text('symbol'),
    narrativeTheme: text('narrative_theme'),
    category: text('category'),
    firstSeenAt: bigint('first_seen_at', { mode: 'number' }),
    marketCap: numeric('market_cap'),
    pushed: integer('pushed').default(0),
    seenCount: integer('seen_count').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    narrativeThemeIdx: index('idx_radar_tokens_seen_narrative_theme').on(table.narrativeTheme),
    firstSeenAtIdx: index('idx_radar_tokens_seen_first_seen_at').on(table.firstSeenAt),
  })
);

export const postgresRadarAlerts = pgTable(
  'radar_alerts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    chain: text('chain').notNull(),
    address: text('address').notNull(),
    signalCount: integer('signal_count').notNull().default(1),
    name: text('name'),
    symbol: text('symbol'),
    imageUrl: text('image_url'),
    price: numeric('price'),
    mc: numeric('mc'),
    liq: numeric('liq'),
    volume: numeric('volume'),
    smartMoney: integer('smart_money'),
    holders: integer('holders'),
    buySellRatio: numeric('buy_sell_ratio'),
    ageHours: numeric('age_hours'),
    change1h: numeric('change_1h'),
    pctGain: numeric('pct_gain'),
    stars: integer('stars'),
    narrativeTag: text('narrative_tag'),
    category: text('category'),
    twitter: text('twitter'),
    telegram: text('telegram'),
    website: text('website'),
    message: text('message'),
    pushedAt: bigint('pushed_at', { mode: 'number' }).notNull(),
    tradeScore: integer('trade_score'),
    tradeStatus: text('trade_status'),
    tradeReason: text('trade_reason'),
    tradeDecisionAt: bigint('trade_decision_at', { mode: 'number' }),
    paperPositionStatus: text('paper_position_status'),
    paperPositionSizeUsd: numeric('paper_position_size_usd'),
    paperTokenAmount: numeric('paper_token_amount'),
    paperEntryPrice: numeric('paper_entry_price'),
    paperCurrentPrice: numeric('paper_current_price'),
    paperPnLPct: numeric('paper_pnl_pct'),
    paperOpenedAt: bigint('paper_opened_at', { mode: 'number' }),
    paperClosedAt: bigint('paper_closed_at', { mode: 'number' }),
    paperCloseReason: text('paper_close_reason'),
    paperTakeProfitPct: numeric('paper_take_profit_pct'),
    paperStopLossPct: numeric('paper_stop_loss_pct'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueSignalIdx: uniqueIndex('radar_alerts_chain_address_signal_count_key').on(
      table.chain,
      table.address,
      table.signalCount
    ),
    pushedAtIdx: index('idx_radar_alerts_pushed_at').on(table.pushedAt),
    chainAddressIdx: index('idx_radar_alerts_chain_address').on(table.chain, table.address),
    createdAtIdx: index('idx_radar_alerts_created_at').on(table.createdAt),
  })
);

export const postgresRadarPositions = pgTable(
  'radar_positions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    chain: text('chain').notNull(),
    address: text('address').notNull(),
    name: text('name'),
    symbol: text('symbol'),
    imageUrl: text('image_url'),
    entrySignalCount: integer('entry_signal_count').notNull(),
    tradeScore: integer('trade_score'),
    positionSizeUsd: numeric('position_size_usd'),
    targetPositionSizeUsd: numeric('target_position_size_usd'),
    tokenAmount: numeric('token_amount'),
    remainingTokenAmount: numeric('remaining_token_amount'),
    remainingPositionSizeUsd: numeric('remaining_position_size_usd'),
    realizedPnlUsd: numeric('realized_pnl_usd').default('0'),
    realizedProceedsUsd: numeric('realized_proceeds_usd').default('0'),
    tpStage: integer('tp_stage').default(0),
    tpPlanJson: text('tp_plan_json'),
    entryPrice: numeric('entry_price').notNull(),
    currentPrice: numeric('current_price'),
    takeProfitPct: numeric('take_profit_pct').notNull(),
    stopLossPct: numeric('stop_loss_pct').notNull(),
    status: text('status').notNull(),
    openedAt: bigint('opened_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    closedAt: bigint('closed_at', { mode: 'number' }),
    closePrice: numeric('close_price'),
    closeReason: text('close_reason'),
    pnlPct: numeric('pnl_pct').notNull().default('0'),
    smartMoney: integer('smart_money'),
    buySellRatio: numeric('buy_sell_ratio'),
    liquidity: numeric('liquidity'),
    volume: numeric('volume'),
    entryStage: integer('entry_stage').default(3),
    peakPrice: numeric('peak_price'),
    peakPnlPct: numeric('peak_pnl_pct').default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueSignalIdx: uniqueIndex('radar_positions_chain_address_entry_signal_count_key').on(
      table.chain,
      table.address,
      table.entrySignalCount
    ),
    statusUpdatedIdx: index('idx_radar_positions_status_updated_at').on(table.status, table.updatedAt),
    chainAddressIdx: index('idx_radar_positions_chain_address').on(table.chain, table.address),
    createdAtIdx: index('idx_radar_positions_created_at').on(table.createdAt),
  })
);

export const postgresRadarTradeIntents = pgTable(
  'radar_trade_intents',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
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
    buySellRatio: numeric('buy_sell_ratio'),
    liquidity: numeric('liquidity'),
    volume: numeric('volume'),
    price: numeric('price'),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    insertedAt: timestamp('inserted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueSignalIdx: uniqueIndex('radar_trade_intents_chain_address_signal_count_key').on(
      table.chain,
      table.address,
      table.signalCount
    ),
    createdAtIdx: index('idx_radar_trade_intents_created_at').on(table.createdAt),
    chainAddressIdx: index('idx_radar_trade_intents_chain_address').on(table.chain, table.address),
  })
);

export const postgresRadarRuntimeState = pgTable(
  'radar_runtime_state',
  {
    stateKey: text('state_key').primaryKey(),
    stateType: text('state_type').notNull(),
    chain: text('chain'),
    address: text('address'),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    stateTypeIdx: index('idx_radar_runtime_state_type').on(table.stateType),
    chainAddressIdx: index('idx_radar_runtime_state_chain_address').on(table.chain, table.address),
    updatedAtIdx: index('idx_radar_runtime_state_updated_at').on(table.updatedAt),
  })
);
