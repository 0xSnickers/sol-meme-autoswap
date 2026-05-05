begin;

create extension if not exists pgcrypto;

create table if not exists public.radar_meta (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table if not exists public.radar_alerts (
  id bigint generated always as identity primary key,
  chain text not null,
  address text not null,
  signal_count integer not null default 1,
  name text,
  symbol text,
  price numeric,
  mc numeric,
  liq numeric,
  volume numeric,
  smart_money integer,
  holders integer,
  buy_sell_ratio numeric,
  age_hours numeric,
  change_1h numeric,
  pct_gain numeric,
  stars integer,
  narrative_tag text,
  category text,
  twitter text,
  telegram text,
  website text,
  message text,
  pushed_at bigint not null,
  trade_score integer,
  trade_status text,
  trade_reason text,
  trade_decision_at bigint,
  paper_position_status text,
  paper_position_size_usd numeric,
  paper_token_amount numeric,
  paper_entry_price numeric,
  paper_current_price numeric,
  paper_pnl_pct numeric,
  paper_opened_at bigint,
  paper_closed_at bigint,
  paper_close_reason text,
  paper_take_profit_pct numeric,
  paper_stop_loss_pct numeric,
  created_at timestamptz not null default now(),
  unique (chain, address, signal_count)
);

create index if not exists idx_radar_alerts_pushed_at
  on public.radar_alerts (pushed_at desc);

create index if not exists idx_radar_alerts_chain_address
  on public.radar_alerts (chain, address);

create index if not exists idx_radar_alerts_trade_sort
  on public.radar_alerts (pushed_at desc, smart_money desc, signal_count desc);

create index if not exists idx_radar_alerts_created_at
  on public.radar_alerts (created_at desc);

create table if not exists public.radar_positions (
  id bigint generated always as identity primary key,
  chain text not null,
  address text not null,
  name text,
  symbol text,
  entry_signal_count integer not null,
  trade_score integer,
  position_size_usd numeric,
  token_amount numeric,
  entry_price numeric not null,
  current_price numeric,
  take_profit_pct numeric not null,
  stop_loss_pct numeric not null,
  status text not null,
  opened_at bigint not null,
  updated_at bigint not null,
  closed_at bigint,
  close_price numeric,
  close_reason text,
  pnl_pct numeric not null default 0,
  smart_money integer,
  buy_sell_ratio numeric,
  liquidity numeric,
  volume numeric,
  created_at timestamptz not null default now(),
  unique (chain, address, entry_signal_count)
);

create index if not exists idx_radar_positions_status_updated_at
  on public.radar_positions (status, updated_at desc);

create index if not exists idx_radar_positions_chain_address
  on public.radar_positions (chain, address);

create index if not exists idx_radar_positions_closed_at
  on public.radar_positions (closed_at desc);

create index if not exists idx_radar_positions_created_at
  on public.radar_positions (created_at desc);

create table if not exists public.radar_runtime_state (
  state_key text primary key,
  state_type text not null,
  chain text,
  address text,
  updated_at bigint not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_radar_runtime_state_type
  on public.radar_runtime_state (state_type);

create index if not exists idx_radar_runtime_state_chain_address
  on public.radar_runtime_state (chain, address);

create index if not exists idx_radar_runtime_state_updated_at
  on public.radar_runtime_state (updated_at desc);

create index if not exists idx_radar_runtime_state_created_at
  on public.radar_runtime_state (created_at desc);

commit;
