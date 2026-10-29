-- SafeProducts SP-US2 exact-offer pack guard compatibility v1.
-- Preserve the legacy unknown-pack price guard while allowing a commerce offer
-- with complete exact-pack evidence to remain verified even when the canonical
-- product's legacy pack_size_text field has not yet been populated.

begin;

create or replace function public.sp_catalog_commerce_pack_guard_v1()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare
  v_product_pack text;
  v_offer_pack_qualified boolean := false;
begin
  select nullif(btrim(pack_size_text),'')
    into v_product_pack
  from public.sp_catalog_product_v1
  where id=new.product_id;

  v_offer_pack_qualified :=
    coalesce(new.exact_pack_match,false) = true
    and nullif(btrim(new.pack_normalized_key),'') is not null
    and new.pack_normalized_value > 0
    and new.pack_normalized_unit in ('ml','g','count')
    and new.offer_confidence >= 90
    and new.market_country_code = 'IN'
    and new.currency = 'INR'
    and new.source_url ~ '^https://';

  if new.verified=true
     and new.price is not null
     and v_product_pack is null
     and not v_offer_pack_qualified then
    new.verified:=false;
    new.availability_status:='UNKNOWN';
    new.notes:=left(concat_ws(' ',new.notes,'Consumer price verification withheld because the exact product pack size is not yet known.'),4000);
  end if;

  return new;
end;
$$;

revoke all on function public.sp_catalog_commerce_pack_guard_v1() from public,anon,authenticated;

-- Repair only offers that the legacy guard withheld solely for missing
-- product-level pack text and that already carry complete exact-pack evidence.
-- The review queue remains untouched: canonical product-pack review can still
-- proceed independently of whether this exact merchant offer is publishable.
update public.sp_catalog_commerce_offer_v1
set verified=true,
    notes=nullif(
      btrim(
        regexp_replace(
          coalesce(notes,''),
          '\s*Consumer price verification withheld because the exact product pack size is not yet known\.',
          '',
          'g'
        )
      ),
      ''
    ),
    updated_at=now()
where verified = false
  and price > 0
  and exact_pack_match = true
  and pack_normalized_key is not null
  and pack_normalized_value > 0
  and pack_normalized_unit in ('ml','g','count')
  and offer_confidence >= 90
  and market_country_code = 'IN'
  and currency = 'INR'
  and source_url ~ '^https://'
  and (valid_until is null or valid_until > now())
  and coalesce(notes,'') like '%Consumer price verification withheld because the exact product pack size is not yet known.%';

commit;
