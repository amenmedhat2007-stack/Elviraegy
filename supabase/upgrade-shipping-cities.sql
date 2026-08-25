-- Elvira: individual city shipping management
create table if not exists public.shipping_cities (
  id uuid primary key default gen_random_uuid(),
  city_name text not null unique check (length(trim(city_name)) between 2 and 120),
  fee numeric(12,2) not null default 0 check (fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shipping_cities_city_name_idx on public.shipping_cities(city_name);
create index if not exists shipping_cities_active_idx on public.shipping_cities(active);

drop trigger if exists shipping_cities_set_updated_at on public.shipping_cities;
create trigger shipping_cities_set_updated_at before update on public.shipping_cities
for each row execute function public.set_updated_at();

insert into public.shipping_cities(city_name,fee) values
('Cairo',80),('Giza',80),('Qalyubia',80),
('Alexandria',100),('Mansoura',100),('Tanta',100),('Zagazig',100),('Kafr El Sheikh',100),('Damanhur',100),('Banha',100),('Damietta',100),('Port Said',100),('Ismailia',100),('Suez',100),
('Fayoum',120),('Beni Suef',120),('Minya',120),('Asyut',120),('Sohag',120),('Qena',120),('Luxor',120),('Aswan',120),
('Hurghada',150),('Marsa Alam',150),('Sharm El Sheikh',150),('El Tor',150),('Matrouh',150),('New Valley',150),('Other',150)
on conflict (city_name) do nothing;

alter table public.shipping_cities enable row level security;
drop policy if exists "public read shipping cities" on public.shipping_cities;
drop policy if exists "admin manage shipping cities" on public.shipping_cities;
create policy "public read shipping cities" on public.shipping_cities for select using (active=true);
create policy "admin manage shipping cities" on public.shipping_cities for all using (public.is_admin()) with check (public.is_admin());

-- Orders keep the exact city the customer selected. This export-friendly field already exists.
-- Secure order placement now reads the individual city's configured fee instead of the old regional bucket.
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
  v_city_row public.shipping_cities;
  v_offer public.offers;
  v_original numeric(12,2);
  v_unit numeric(12,2);
  v_discount numeric(12,2);
  v_subtotal numeric(12,2);
  v_shipping numeric(12,2);
  v_total numeric(12,2);
  v_order_id uuid;
  v_order_number text;
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

  select * into v_city_row from public.shipping_cities where lower(city_name)=lower(trim(p_city)) and active=true limit 1;
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
  v_shipping:=v_city_row.fee;
  v_total:=v_subtotal+v_shipping;
  v_order_number:='ELV-'||to_char(now(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  insert into public.orders(order_number,client_request_id,customer_name,whatsapp,phone,address,city,shipping_zone_id,subtotal,discount,shipping_fee,total,status,notes)
  values(v_order_number,trim(p_client_request_id),trim(p_customer_name),trim(p_whatsapp),trim(p_phone),trim(p_address),trim(p_city),null,v_subtotal,v_discount,v_shipping,v_total,'pending','')
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

revoke all on function public.place_order_by_city_secure(uuid,integer,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.place_order_by_city_secure(uuid,integer,text,text,text,text,text,text) to service_role;

NOTIFY pgrst, 'reload schema';
