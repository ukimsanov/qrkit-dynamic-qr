create extension if not exists "uuid-ossp";

create table if not exists urls (
  id uuid primary key default uuid_generate_v4(),
  short_code varchar(16) unique not null,
  long_url text not null,
  alias varchar(32) unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  qr_status varchar(16),
  qr_url text
);

create table if not exists click_totals (
  short_code varchar(16) primary key references urls(short_code) on delete cascade,
  total_clicks bigint not null default 0,
  updated_at timestamptz not null default now()
);
