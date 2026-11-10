-- Runs the fetch-gold-prices Edge Function every weekday at 17:00 UTC
-- (18:00 in Paris in winter, 19:00 in summer).
--
-- The function URL and the shared secret are read from Supabase Vault at run time,
-- so this migration holds no secret and works unchanged in every environment.
-- They are created once per project, outside version control:
--   select vault.create_secret('<function url>', 'fetch_gold_prices_url');
--   select vault.create_secret('<random secret>', 'fetch_gold_prices_cron_secret');
-- The same secret is set as CRON_SECRET in the Edge Function secrets.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'fetch-gold-prices',
  '0 17 * * 1-5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'fetch_gold_prices_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fetch_gold_prices_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
