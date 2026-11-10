-- Access rules: who can read and write what.
-- Fixture: two portfolios; Alice is admin of the first, Bob a member of it,
-- Carol admin of the second only. Everything is rolled back at the end.
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- Fixture (as postgres, bypassing RLS) ---------------------------------------

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.test', 'authenticated', 'authenticated');

insert into public.portfolios (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Family'),
  ('10000000-0000-0000-0000-000000000002', 'Other family');

insert into public.portfolio_members (portfolio_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'admin');

insert into public.participants (id, portfolio_id, display_name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Participant A'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Participant B'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Participant C');

insert into public.purchases (id, portfolio_id, product_id, purchased_on, total_price_cents) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (select id from public.products where code = 'bar-10g'), '2026-01-15', 100000);

insert into public.purchase_shares (purchase_id, portfolio_id, participant_id, paid_cents) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 60000),
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', 40000);

insert into public.gold_prices (product_id, price_date, quote_cents, source, status) values
  ((select id from public.products where code = 'bar-10g'), '2026-01-15', 120000, 'dealer', 'ok'),
  ((select id from public.products where code = 'bar-10g'), '2026-01-16', 999900, 'dealer', 'quarantined');

-- Anonymous visitor -----------------------------------------------------------

set local role anon;

select is((select count(*)::int from public.products), 2, 'anon reads the product catalogue');
select is((select count(*)::int from public.gold_prices), 1, 'anon reads published prices but not quarantined ones');
select throws_ok('select * from public.purchases', '42501', null, 'anon cannot read purchases');
select throws_ok('select * from public.portfolio_members', '42501', null, 'anon cannot read members');
select throws_ok(
  $$ insert into public.gold_prices (product_id, price_date, quote_cents, source)
     values (1, '2026-02-01', 1, 'dealer') $$,
  '42501', null, 'anon cannot write prices'
);

-- Signed-in user who belongs to no portfolio -----------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';

select is((select count(*)::int from public.purchases), 0, 'an outsider sees no purchases');
select is((select count(*)::int from public.participants), 0, 'an outsider sees no participants');

-- Family member (read only) ------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is((select count(*)::int from public.purchases), 1, 'a member reads their family purchases');
select is((select count(*)::int from public.purchase_shares), 2, 'a member reads the shares');
select is((select count(*)::int from public.participants), 2, 'a member sees only their family participants');
select throws_ok(
  $$ insert into public.purchases (portfolio_id, product_id, purchased_on, total_price_cents)
     values ('10000000-0000-0000-0000-000000000001', 1, '2026-02-01', 50000) $$,
  '42501', null, 'a member cannot add purchases'
);
select is_empty(
  $$ update public.purchases set note = 'edited' returning id $$,
  'a member cannot edit purchases'
);
select is((select count(*)::int from public.price_fetch_runs), 0, 'a member cannot read the price job log');

-- Admin of the family portfolio -------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.purchases (id, portfolio_id, product_id, purchased_on, total_price_cents)
       values ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 1, '2026-02-01', 50000);
     insert into public.purchase_shares (purchase_id, portfolio_id, participant_id, paid_cents)
       values ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
               '20000000-0000-0000-0000-000000000001', 50000);
     set constraints all immediate;
     set constraints all deferred; $$,
  'the admin adds a purchase whose shares match the total'
);

select throws_ok(
  $$ insert into public.purchases (id, portfolio_id, product_id, purchased_on, total_price_cents)
       values ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 1, '2026-02-02', 50000);
     insert into public.purchase_shares (purchase_id, portfolio_id, participant_id, paid_cents)
       values ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
               '20000000-0000-0000-0000-000000000001', 49999);
     set constraints all immediate; $$,
  '23514', null, 'shares that do not add up to the total are rejected'
);

select throws_ok(
  $$ insert into public.purchases (portfolio_id, product_id, purchased_on, total_price_cents)
     values ('10000000-0000-0000-0000-000000000002', 1, '2026-02-01', 50000) $$,
  '42501', null, 'an admin cannot write into another family portfolio'
);

select throws_ok(
  $$ insert into public.purchase_shares (purchase_id, portfolio_id, participant_id, paid_cents)
     values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
             '20000000-0000-0000-0000-000000000003', 1) $$,
  '23503', null, 'a share cannot point to a participant of another portfolio'
);

select * from finish();

rollback;
