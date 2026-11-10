-- Guards against a table being exposed without Row Level Security.
-- The cloud project has "automatic RLS" turned off on purpose, so every migration
-- must enable RLS explicitly; this test fails the CI if one forgets to.
begin;

create extension if not exists pgtap with schema extensions;

select plan(1);

select is_empty(
  $$
    select format('%I.%I', schemaname, tablename)
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and not rowsecurity
  $$,
  'Every table in the public schema has Row Level Security enabled'
);

select * from finish();

rollback;
