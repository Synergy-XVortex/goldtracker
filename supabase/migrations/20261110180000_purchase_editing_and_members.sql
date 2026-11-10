-- Purchase editing from the app, and member e-mails for the admin screen.

-- ---------------------------------------------------------------------------
-- Members: keep the invited address so admins can see who has access.
-- auth.users is not readable from the app, so the e-mail is copied here by
-- the add-family-member Edge Function when it grants access.
-- ---------------------------------------------------------------------------

alter table public.portfolio_members add column email text;

comment on column public.portfolio_members.email is
  'Address the member signs in with, copied at invitation time for display.';

-- Members added before this column existed (the first admin).
update public.portfolio_members as member
set email = account.email
from auth.users as account
where account.id = member.user_id
  and member.email is null;

-- ---------------------------------------------------------------------------
-- save_purchase: creates or replaces a purchase and its shares in one call.
-- A purchase and its shares must be written in the same transaction, because
-- the deferred check requires shares to add up to the total at commit time.
-- Security invoker: Row Level Security still decides who may write (admins).
-- ---------------------------------------------------------------------------

create function public.save_purchase(
  p_purchase_id uuid,
  p_portfolio_id uuid,
  p_product_id smallint,
  p_quantity integer,
  p_purchased_on date,
  p_total_price_cents bigint,
  p_fees_cents bigint,
  p_seller text,
  p_note text,
  p_shares jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  -- Defer the total check while the purchase and its shares are being rewritten.
  set constraints public.purchases_shares_total, public.purchase_shares_total deferred;

  if jsonb_typeof(p_shares) is distinct from 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'A purchase needs at least one share' using errcode = 'check_violation';
  end if;

  if p_purchase_id is null then
    insert into public.purchases (
      portfolio_id, product_id, quantity, purchased_on, total_price_cents, fees_cents, seller, note
    ) values (
      p_portfolio_id, p_product_id, p_quantity, p_purchased_on, p_total_price_cents,
      coalesce(p_fees_cents, 0), nullif(trim(p_seller), ''), nullif(trim(p_note), '')
    )
    returning id into saved_id;
  else
    update public.purchases
    set product_id = p_product_id,
        quantity = p_quantity,
        purchased_on = p_purchased_on,
        total_price_cents = p_total_price_cents,
        fees_cents = coalesce(p_fees_cents, 0),
        seller = nullif(trim(p_seller), ''),
        note = nullif(trim(p_note), '')
    where id = p_purchase_id
      and portfolio_id = p_portfolio_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Purchase % not found or not editable', p_purchase_id
        using errcode = 'insufficient_privilege';
    end if;

    delete from public.purchase_shares where purchase_id = saved_id;
  end if;

  insert into public.purchase_shares (purchase_id, portfolio_id, participant_id, paid_cents)
  select saved_id, p_portfolio_id, (share ->> 'participant_id')::uuid, (share ->> 'paid_cents')::bigint
  from jsonb_array_elements(p_shares) as share;

  -- Check the total now so the caller gets the error from this call.
  set constraints public.purchases_shares_total, public.purchase_shares_total immediate;

  return saved_id;
end;
$$;

revoke all on function public.save_purchase(uuid, uuid, smallint, integer, date, bigint, bigint, text, text, jsonb) from public, anon;
grant execute on function public.save_purchase(uuid, uuid, smallint, integer, date, bigint, bigint, text, text, jsonb) to authenticated;
