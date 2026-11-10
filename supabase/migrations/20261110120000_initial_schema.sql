-- GoldTracker initial schema: catalogue, gold prices, family portfolio and purchases.
--
-- Conventions
--   * Amounts are integer euro cents (bigint), weights are grams (numeric).
--   * Every table enables Row Level Security; new tables are NOT exposed to the
--     Data API automatically, so each grant below is deliberate.
--   * Helper functions live in the `private` schema, which the Data API does not expose.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.products (
  id smallint generated always as identity primary key,
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  label text not null,
  fine_weight_grams numeric(10, 4) not null check (fine_weight_grams > 0),
  dealer_url text check (dealer_url is null or dealer_url like 'https://%'),
  created_at timestamptz not null default now()
);

comment on table public.products is 'Gold products that can be bought and priced (bars, coins).';

insert into public.products (code, label, fine_weight_grams, dealer_url) values
  ('bar-10g', 'Lingot 10 g', 10, 'https://www.achat-or-et-argent.fr/or/lingot-10g-or/3551'),
  ('bar-20g', 'Lingot 20 g', 20, 'https://www.achat-or-et-argent.fr/or/lingot-20g-or/3552');

-- ---------------------------------------------------------------------------
-- Daily prices
-- ---------------------------------------------------------------------------

create type public.price_status as enum ('ok', 'estimated', 'quarantined');

create table public.gold_prices (
  product_id smallint not null references public.products (id),
  price_date date not null,
  -- Dealer quote ("cotation"): the value used to price the portfolio by default.
  quote_cents bigint not null check (quote_cents > 0),
  -- Dealer selling price for 1 to 9 units, and buyback price. Missing for imported history.
  buy_cents bigint check (buy_cents > 0),
  buyback_cents bigint check (buyback_cents > 0),
  spot_eur_per_troy_ounce numeric(12, 4) check (spot_eur_per_troy_ounce > 0),
  source text not null check (source in ('dealer', 'spot-estimate', 'sheet-import')),
  status public.price_status not null default 'ok',
  fetched_at timestamptz not null default now(),
  primary key (product_id, price_date)
);

comment on table public.gold_prices is
  'One price record per product and day. Only ok and estimated rows are visible to readers; quarantined rows wait for review.';

create table public.price_fetch_runs (
  id bigint generated always as identity primary key,
  product_id smallint references public.products (id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null check (outcome in ('ok', 'estimated', 'quarantined', 'failed')),
  detail text
);

comment on table public.price_fetch_runs is 'Log of the daily price job, one row per product and attempt.';

-- ---------------------------------------------------------------------------
-- Family portfolio
-- ---------------------------------------------------------------------------

create type public.portfolio_role as enum ('admin', 'member');

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (portfolio_id, display_name),
  -- Target of composite foreign keys that keep rows inside one portfolio.
  unique (id, portfolio_id)
);

comment on table public.participants is
  'People between whom purchases are split. A participant does not need an account.';

create table public.portfolio_members (
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.portfolio_role not null default 'member',
  -- Optional link so a member sees their own line first.
  participant_id uuid,
  created_at timestamptz not null default now(),
  primary key (portfolio_id, user_id),
  foreign key (participant_id, portfolio_id)
    references public.participants (id, portfolio_id) on delete set null (participant_id)
);

comment on table public.portfolio_members is
  'Accounts allowed to see a portfolio. Managed by the service role (invitations), not by the app.';

create index portfolio_members_user_id_idx on public.portfolio_members (user_id);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  product_id smallint not null references public.products (id),
  quantity integer not null default 1 check (quantity > 0),
  purchased_on date not null,
  -- Total amount paid, fees included. The shares of a purchase must add up to it.
  total_price_cents bigint not null check (total_price_cents > 0),
  -- Part of the total that was fees (delivery, commission). Informational.
  fees_cents bigint not null default 0 check (fees_cents >= 0),
  seller text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fees_cents < total_price_cents),
  unique (id, portfolio_id)
);

create index purchases_portfolio_id_idx on public.purchases (portfolio_id, purchased_on);

create table public.purchase_shares (
  purchase_id uuid not null,
  portfolio_id uuid not null,
  participant_id uuid not null,
  paid_cents bigint not null check (paid_cents > 0),
  primary key (purchase_id, participant_id),
  foreign key (purchase_id, portfolio_id)
    references public.purchases (id, portfolio_id) on delete cascade,
  foreign key (participant_id, portfolio_id)
    references public.participants (id, portfolio_id)
);

comment on table public.purchase_shares is
  'How much each participant paid for a purchase. A single-owner purchase has one share.';

create index purchase_shares_portfolio_id_idx on public.purchase_shares (portfolio_id);
create index purchase_shares_participant_id_idx on public.purchase_shares (participant_id);

-- ---------------------------------------------------------------------------
-- Integrity: shares must add up to the purchase total
-- ---------------------------------------------------------------------------
-- Checked at commit time (deferred) so a purchase and its shares can be written
-- in any order within one transaction.

create function private.assert_purchase_shares_total(target_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_total bigint;
  shares_total bigint;
begin
  select total_price_cents into expected_total
  from public.purchases
  where id = target_purchase_id;

  -- The purchase was deleted in the same transaction: its shares are gone too.
  if not found then
    return;
  end if;

  select coalesce(sum(paid_cents), 0) into shares_total
  from public.purchase_shares
  where purchase_id = target_purchase_id;

  if shares_total <> expected_total then
    raise exception 'Shares of purchase % add up to % cents instead of % cents',
      target_purchase_id, shares_total, expected_total
      using errcode = 'check_violation';
  end if;
end;
$$;

create function private.on_purchase_written()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_purchase_shares_total(new.id);
  return null;
end;
$$;

create function private.on_purchase_share_written()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.assert_purchase_shares_total(old.purchase_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.assert_purchase_shares_total(new.purchase_id);
  end if;
  return null;
end;
$$;

create constraint trigger purchases_shares_total
  after insert or update of total_price_cents on public.purchases
  deferrable initially deferred
  for each row execute function private.on_purchase_written();

create constraint trigger purchase_shares_total
  after insert or update or delete on public.purchase_shares
  deferrable initially deferred
  for each row execute function private.on_purchase_share_written();

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger purchases_touch_updated_at
  before update on public.purchases
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
-- Security definer so policies can read portfolio_members without recursing
-- into that table's own policies.

create function private.is_portfolio_member(target_portfolio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.portfolio_members
    where portfolio_id = target_portfolio_id
      and user_id = (select auth.uid())
  );
$$;

create function private.is_portfolio_admin(target_portfolio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.portfolio_members
    where portfolio_id = target_portfolio_id
      and user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

create function private.is_any_portfolio_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.portfolio_members
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function
  private.is_portfolio_member(uuid),
  private.is_portfolio_admin(uuid),
  private.is_any_portfolio_admin()
to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.gold_prices enable row level security;
alter table public.price_fetch_runs enable row level security;
alter table public.portfolios enable row level security;
alter table public.participants enable row level security;
alter table public.portfolio_members enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_shares enable row level security;

-- Public data: anyone, signed in or not, can read the catalogue and published prices.
create policy "Anyone can read products"
  on public.products for select
  to anon, authenticated
  using (true);

create policy "Anyone can read published prices"
  on public.gold_prices for select
  to anon, authenticated
  using (status in ('ok', 'estimated'));

-- Price job log: portfolio admins only. Rows are written by the service role.
create policy "Admins can read the price job log"
  on public.price_fetch_runs for select
  to authenticated
  using ((select private.is_any_portfolio_admin()));

-- Portfolio data: members read, admins write.
create policy "Members can read their portfolios"
  on public.portfolios for select
  to authenticated
  using ((select private.is_portfolio_member(id)));

create policy "Members can read the member list"
  on public.portfolio_members for select
  to authenticated
  using ((select private.is_portfolio_member(portfolio_id)));

create policy "Members can read participants"
  on public.participants for select
  to authenticated
  using ((select private.is_portfolio_member(portfolio_id)));

create policy "Admins can add participants"
  on public.participants for insert
  to authenticated
  with check ((select private.is_portfolio_admin(portfolio_id)));

create policy "Admins can update participants"
  on public.participants for update
  to authenticated
  using ((select private.is_portfolio_admin(portfolio_id)))
  with check ((select private.is_portfolio_admin(portfolio_id)));

create policy "Members can read purchases"
  on public.purchases for select
  to authenticated
  using ((select private.is_portfolio_member(portfolio_id)));

create policy "Admins can add purchases"
  on public.purchases for insert
  to authenticated
  with check ((select private.is_portfolio_admin(portfolio_id)));

create policy "Admins can update purchases"
  on public.purchases for update
  to authenticated
  using ((select private.is_portfolio_admin(portfolio_id)))
  with check ((select private.is_portfolio_admin(portfolio_id)));

create policy "Admins can delete purchases"
  on public.purchases for delete
  to authenticated
  using ((select private.is_portfolio_admin(portfolio_id)));

create policy "Members can read purchase shares"
  on public.purchase_shares for select
  to authenticated
  using ((select private.is_portfolio_member(portfolio_id)));

create policy "Admins can add purchase shares"
  on public.purchase_shares for insert
  to authenticated
  with check ((select private.is_portfolio_admin(portfolio_id)));

create policy "Admins can update purchase shares"
  on public.purchase_shares for update
  to authenticated
  using ((select private.is_portfolio_admin(portfolio_id)))
  with check ((select private.is_portfolio_admin(portfolio_id)));

create policy "Admins can delete purchase shares"
  on public.purchase_shares for delete
  to authenticated
  using ((select private.is_portfolio_admin(portfolio_id)));

-- ---------------------------------------------------------------------------
-- Grants (explicit, since new tables are not exposed automatically)
-- ---------------------------------------------------------------------------

grant select on public.products, public.gold_prices to anon, authenticated;

grant select on
  public.price_fetch_runs,
  public.portfolios,
  public.portfolio_members,
  public.participants,
  public.purchases,
  public.purchase_shares
to authenticated;

-- Participants are archived rather than deleted, so their past shares stay intact.
grant insert, update on public.participants to authenticated;
grant insert, update, delete on public.purchases, public.purchase_shares to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
