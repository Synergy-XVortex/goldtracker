-- save_purchase: admins create and edit purchases with their shares in one call.
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'member@example.test', 'authenticated', 'authenticated');

insert into public.portfolios (id, name) values ('10000000-0000-0000-0000-000000000001', 'Family');

insert into public.portfolio_members (portfolio_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member');

insert into public.participants (id, portfolio_id, display_name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'B');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

create temporary table saved (id uuid) on commit drop;
grant all on saved to authenticated;

insert into saved
select public.save_purchase(
  null, '10000000-0000-0000-0000-000000000001', 1::smallint, 1, '2026-02-01', 150000, 0, ' Godot ', '',
  '[{"participant_id": "20000000-0000-0000-0000-000000000001", "paid_cents": 100000},
    {"participant_id": "20000000-0000-0000-0000-000000000002", "paid_cents": 50000}]'::jsonb
);

select is((select count(*)::int from public.purchases), 1, 'the admin creates a purchase');
select is((select count(*)::int from public.purchase_shares), 2, 'with its two shares');
select is((select seller from public.purchases), 'Godot', 'text fields are trimmed');
select is((select note from public.purchases), null, 'an empty note is stored as null');

select lives_ok(
  format(
    $$ select public.save_purchase(%L, '10000000-0000-0000-0000-000000000001', 1::smallint, 1, '2026-02-01', 120000, 0, null, null,
         '[{"participant_id": "20000000-0000-0000-0000-000000000002", "paid_cents": 120000}]'::jsonb) $$,
    (select id from saved)
  ),
  'the admin edits the purchase and replaces its shares'
);
select is(
  (select string_agg(paid_cents::text, ',') from public.purchase_shares),
  '120000',
  'the old shares are replaced'
);

select throws_ok(
  $$ select public.save_purchase(null, '10000000-0000-0000-0000-000000000001', 1::smallint, 1, '2026-02-02', 50000, 0, null, null,
       '[{"participant_id": "20000000-0000-0000-0000-000000000001", "paid_cents": 40000}]'::jsonb) $$,
  '23514', null, 'shares that do not add up to the total are rejected immediately'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select throws_ok(
  $$ select public.save_purchase(null, '10000000-0000-0000-0000-000000000001', 1::smallint, 1, '2026-02-02', 50000, 0, null, null,
       '[{"participant_id": "20000000-0000-0000-0000-000000000001", "paid_cents": 50000}]'::jsonb) $$,
  '42501', null, 'a member cannot save purchases'
);

select * from finish();

rollback;
