-- ELVIRA HARDENING MIGRATION
-- Apply after the existing schema/upgrade migrations.

alter table public.orders add column if not exists client_request_id text;
create unique index if not exists orders_client_request_id_uidx on public.orders(client_request_id) where client_request_id is not null;

create table if not exists public.order_rate_limits (
  key text primary key,
  window_started timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.order_rate_limits enable row level security;

create or replace function public.consume_order_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if length(trim(p_key)) < 16 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.order_rate_limits(key,window_started,request_count,updated_at)
  values(p_key,now(),1,now())
  on conflict (key) do update
    set request_count = case
      when now() - public.order_rate_limits.window_started >= make_interval(secs => p_window_seconds)
        then 1
      else public.order_rate_limits.request_count + 1
    end,
    window_started = case
      when now() - public.order_rate_limits.window_started >= make_interval(secs => p_window_seconds)
        then now()
      else public.order_rate_limits.window_started
    end,
    updated_at = now()
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

create or replace function public.place_order_by_city_secure(
  p_product_id uuid,
  p_quantity integer,
  p_customer_name text,
  p_whatsapp text,
  p_phone text,
  p_address text,
  p_city text,
  p_client_request_id text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_existing public.orders;
  v_product public.products;
  v_zone public.shipping_zones;
  v_offer public.offers;
  v_original numeric(12,2);
  v_unit numeric(12,2);
  v_discount numeric(12,2);
  v_subtotal numeric(12,2);
  v_shipping numeric(12,2);
  v_total numeric(12,2);
  v_order_id uuid;
  v_order_number text;
  v_zone_name text;
  v_city text := lower(trim(p_city));
begin
  if length(trim(p_client_request_id)) < 8 or length(trim(p_client_request_id)) > 80 then raise exception 'Invalid request id'; end if;

  select * into v_existing from public.orders where client_request_id=trim(p_client_request_id) limit 1;
  if found then
    return jsonb_build_object('order_number',v_existing.order_number,'order_id',v_existing.id,'shipping_fee',v_existing.shipping_fee,'subtotal',v_existing.subtotal,'discount',v_existing.discount,'total',v_existing.total,'idempotent',true);
  end if;

  if p_quantity < 1 or p_quantity > 10 then raise exception 'Quantity must be between 1 and 10'; end if;
  if length(trim(p_customer_name))<2 or length(trim(p_customer_name))>160 then raise exception 'Please enter your full name'; end if;
  if length(trim(p_whatsapp))<6 or length(trim(p_whatsapp))>30 then raise exception 'Please enter a valid WhatsApp number'; end if;
  if length(trim(p_phone))<6 or length(trim(p_phone))>30 then raise exception 'Please enter a valid phone number'; end if;
  if length(trim(p_address))<5 or length(trim(p_address))>500 then raise exception 'Please enter your delivery address'; end if;
  if length(trim(p_city))<2 or length(trim(p_city))>120 then raise exception 'Please choose your city'; end if;

  v_zone_name := case
    when v_city in ('cairo','giza','qalyubia') then 'Greater Cairo'
    when v_city in ('alexandria','mansoura','tanta','zagazig','kafr el sheikh','damanhur','banha','damietta','port said','ismailia','suez') then 'Nile Delta'
    when v_city in ('fayoum','beni suef','minya','asyut','sohag','qena','luxor','aswan') then 'Upper Egypt'
    else 'Remote Areas'
  end;

  select * into v_zone from public.shipping_zones where name=v_zone_name and active=true;
  if not found then raise exception 'Shipping fee is not configured for this city'; end if;

  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if v_product.stock<p_quantity then raise exception 'Only % units are available',v_product.stock; end if;

  select * into v_offer from public.offers where product_id=v_product.id and active=true
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())
    order by created_at desc limit 1;

  v_original:=v_product.price; v_unit:=v_original;
  if found then
    if v_offer.discount_type='percent' then v_unit:=greatest(0,v_original*(1-v_offer.discount_value/100));
    else v_unit:=greatest(0,v_original-v_offer.discount_value); end if;
  end if;

  v_discount:=greatest(0,(v_original-v_unit)*p_quantity);
  v_subtotal:=v_unit*p_quantity;
  v_shipping:=v_zone.fee;
  v_total:=v_subtotal+v_shipping;
  v_order_number:='ELV-'||to_char(now(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  insert into public.orders(order_number,client_request_id,customer_name,whatsapp,phone,address,city,shipping_zone_id,subtotal,discount,shipping_fee,total,status,notes)
  values(v_order_number,trim(p_client_request_id),trim(p_customer_name),trim(p_whatsapp),trim(p_phone),trim(p_address),trim(p_city),v_zone.id,v_subtotal,v_discount,v_shipping,v_total,'pending','')
  returning id into v_order_id;

  insert into public.order_items(order_id,product_id,product_name,quantity,original_unit_price,unit_price,discount_amount,offer_title,line_total)
  values(v_order_id,v_product.id,v_product.name,p_quantity,v_original,v_unit,v_discount,case when v_offer.id is null then null else v_offer.title end,v_subtotal);

  update public.products set stock=stock-p_quantity where id=v_product.id;

  return jsonb_build_object('order_number',v_order_number,'order_id',v_order_id,'shipping_fee',v_shipping,'subtotal',v_subtotal,'discount',v_discount,'total',v_total,'idempotent',false);
exception
  when unique_violation then
    select * into v_existing from public.orders where client_request_id=trim(p_client_request_id) limit 1;
    if found then
      return jsonb_build_object('order_number',v_existing.order_number,'order_id',v_existing.id,'shipping_fee',v_existing.shipping_fee,'subtotal',v_existing.subtotal,'discount',v_existing.discount,'total',v_existing.total,'idempotent',true);
    end if;
    raise;
end;
$$;

revoke all on function public.place_order(uuid,integer,text,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.place_order_by_city(uuid,integer,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.place_order_by_city_secure(uuid,integer,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.consume_order_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.place_order_by_city_secure(uuid,integer,text,text,text,text,text,text) to service_role;
grant execute on function public.consume_order_rate_limit(text,integer,integer) to service_role;

drop policy if exists "admin read order rate limits" on public.order_rate_limits;
