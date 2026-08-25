alter table public.site_settings add column if not exists support_whatsapp text not null default '';
alter table public.site_settings add column if not exists support_phone text not null default '';
-- Elvira upgrade for an existing Supabase database
alter table public.categories add column if not exists gender text not null default 'female';
alter table public.products add column if not exists gender text not null default 'female';
update public.categories set gender='female' where gender not in ('male','female') or gender is null;
update public.products set gender='female' where gender not in ('male','female') or gender is null;
insert into public.categories(name,slug,gender) values ('Female Fragrance','female-fragrance','female'),('Male Fragrance','male-fragrance','male') on conflict (name) do update set gender=excluded.gender;
alter table public.categories drop constraint if exists categories_gender_check;
alter table public.categories add constraint categories_gender_check check (gender in ('male','female'));
alter table public.products drop constraint if exists products_gender_check;
alter table public.products add constraint products_gender_check check (gender in ('male','female'));

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  fee numeric(12,2) not null check (fee >= 0), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.shipping_zones(name,fee) values('Greater Cairo',80),('Nile Delta',100),('Upper Egypt',120),('Remote Areas',150)
on conflict (name) do update set fee=excluded.fee;

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), order_number text not null unique,
 customer_name text not null, whatsapp text not null, phone text not null, address text not null, city text not null,
 shipping_zone_id uuid references public.shipping_zones(id) on delete restrict,
 subtotal numeric(12,2) not null check (subtotal>=0), discount numeric(12,2) not null default 0 check (discount>=0),
 shipping_fee numeric(12,2) not null default 0 check (shipping_fee>=0), total numeric(12,2) not null check (total>=0),
 status text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
 notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null, product_name text not null, quantity integer not null check(quantity>0),
 original_unit_price numeric(12,2) not null check(original_unit_price>=0), unit_price numeric(12,2) not null check(unit_price>=0),
 discount_amount numeric(12,2) not null default 0 check(discount_amount>=0), offer_title text, line_total numeric(12,2) not null check(line_total>=0),
 created_at timestamptz not null default now()
);

create index if not exists products_gender_idx on public.products(gender);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists shipping_zones_set_updated_at on public.shipping_zones;
create trigger shipping_zones_set_updated_at before update on public.shipping_zones for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create or replace function public.write_audit_log() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.audit_logs(actor_id,table_name,action,record_id,old_data,new_data)
values(auth.uid(),TG_TABLE_NAME,TG_OP,coalesce(new.id,old.id)::text,to_jsonb(old),to_jsonb(new)); return coalesce(new,old); end; $$;

drop trigger if exists shipping_zones_audit on public.shipping_zones;
create trigger shipping_zones_audit after insert or update or delete on public.shipping_zones for each row execute function public.write_audit_log();
drop trigger if exists orders_audit on public.orders;
create trigger orders_audit after insert or update or delete on public.orders for each row execute function public.write_audit_log();

create or replace function public.place_order(p_product_id uuid,p_quantity integer,p_customer_name text,p_whatsapp text,p_phone text,p_address text,p_city text,p_shipping_zone_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_product public.products; v_zone public.shipping_zones; v_offer public.offers; v_original numeric(12,2); v_unit numeric(12,2); v_discount numeric(12,2); v_subtotal numeric(12,2); v_shipping numeric(12,2); v_total numeric(12,2); v_order_id uuid; v_order_number text;
begin
if p_quantity<1 then raise exception 'Quantity must be at least 1'; end if;
if length(trim(p_customer_name))<2 then raise exception 'Please enter your full name'; end if;
if length(trim(p_whatsapp))<6 then raise exception 'Please enter a valid WhatsApp number'; end if;
if length(trim(p_phone))<6 then raise exception 'Please enter a valid phone number'; end if;
if length(trim(p_address))<5 then raise exception 'Please enter your delivery address'; end if;
if length(trim(p_city))<2 then raise exception 'Please enter your city or area'; end if;
select * into v_zone from public.shipping_zones where id=p_shipping_zone_id and active=true; if not found then raise exception 'Please select a valid shipping region'; end if;
select * into v_product from public.products where id=p_product_id for update; if not found then raise exception 'Product not found'; end if;
if v_product.stock<p_quantity then raise exception 'Only % units are available',v_product.stock; end if;
select * into v_offer from public.offers where product_id=v_product.id and active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) order by created_at desc limit 1;
v_original:=v_product.price; v_unit:=v_original;
if found then if v_offer.discount_type='percent' then v_unit:=greatest(0,v_original*(1-v_offer.discount_value/100)); else v_unit:=greatest(0,v_original-v_offer.discount_value); end if; end if;
v_discount:=greatest(0,(v_original-v_unit)*p_quantity); v_subtotal:=v_unit*p_quantity; v_shipping:=v_zone.fee; v_total:=v_subtotal+v_shipping;
v_order_number:='ELV-'||to_char(now(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
insert into public.orders(order_number,customer_name,whatsapp,phone,address,city,shipping_zone_id,subtotal,discount,shipping_fee,total)
values(v_order_number,trim(p_customer_name),trim(p_whatsapp),trim(p_phone),trim(p_address),trim(p_city),v_zone.id,v_subtotal,v_discount,v_shipping,v_total) returning id into v_order_id;
insert into public.order_items(order_id,product_id,product_name,quantity,original_unit_price,unit_price,discount_amount,offer_title,line_total)
values(v_order_id,v_product.id,v_product.name,p_quantity,v_original,v_unit,v_discount,case when v_offer.id is null then null else v_offer.title end,v_subtotal);
update public.products set stock=stock-p_quantity where id=v_product.id;
return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'discount',v_discount,'shipping_fee',v_shipping,'total',v_total);
end; $$;

grant execute on function public.place_order(uuid,integer,text,text,text,text,text,uuid) to anon,authenticated;

alter table public.shipping_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
drop policy if exists "public read shipping zones" on public.shipping_zones;
drop policy if exists "admin manage shipping zones" on public.shipping_zones;
drop policy if exists "admin manage orders" on public.orders;
drop policy if exists "admin read order items" on public.order_items;
create policy "public read shipping zones" on public.shipping_zones for select using (active=true);
create policy "admin manage shipping zones" on public.shipping_zones for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage orders" on public.orders for select using (public.is_admin());
create policy "admin update orders" on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "admin read order items" on public.order_items for select using (public.is_admin());


-- Secure city-based shipping calculator. The shopper chooses only a city; the backend maps it to the configured shipping fee.
create or replace function public.place_order_by_city(
  p_product_id uuid, p_quantity integer, p_customer_name text, p_whatsapp text, p_phone text, p_address text, p_city text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_zone public.shipping_zones; v_product public.products; v_offer public.offers;
  v_original numeric(12,2); v_unit numeric(12,2); v_discount numeric(12,2); v_subtotal numeric(12,2); v_shipping numeric(12,2); v_total numeric(12,2);
  v_order_id uuid; v_order_number text; v_zone_name text; v_city text := lower(trim(p_city));
begin
  if p_quantity < 1 then raise exception 'Quantity must be at least 1'; end if;
  if length(trim(p_customer_name))<2 then raise exception 'Please enter your full name'; end if;
  if length(trim(p_whatsapp))<6 then raise exception 'Please enter a valid WhatsApp number'; end if;
  if length(trim(p_phone))<6 then raise exception 'Please enter a valid phone number'; end if;
  if length(trim(p_address))<5 then raise exception 'Please enter your delivery address'; end if;
  if length(trim(p_city))<2 then raise exception 'Please choose your city'; end if;

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
  if v_product.stock < p_quantity then raise exception 'Only % units are available', v_product.stock; end if;

  select * into v_offer from public.offers where product_id=v_product.id and active=true
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())
    order by created_at desc limit 1;
  v_original:=v_product.price; v_unit:=v_original;
  if found then
    if v_offer.discount_type='percent' then v_unit:=greatest(0,v_original*(1-v_offer.discount_value/100));
    else v_unit:=greatest(0,v_original-v_offer.discount_value); end if;
  end if;
  v_discount:=greatest(0,(v_original-v_unit)*p_quantity); v_subtotal:=v_unit*p_quantity; v_shipping:=v_zone.fee; v_total:=v_subtotal+v_shipping;
  v_order_number:='ELV-'||to_char(now(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.orders(order_number,customer_name,whatsapp,phone,address,city,shipping_zone_id,subtotal,discount,shipping_fee,total,status,notes)
  values(v_order_number,trim(p_customer_name),trim(p_whatsapp),trim(p_phone),trim(p_address),trim(p_city),v_zone.id,v_subtotal,v_discount,v_shipping,v_total,'pending','');
  select id into v_order_id from public.orders where order_number=v_order_number;
  insert into public.order_items(order_id,product_id,product_name,quantity,original_unit_price,unit_price,discount_amount,offer_title,line_total)
  values(v_order_id,v_product.id,v_product.name,p_quantity,v_original,v_unit,v_discount,v_offer.title,v_subtotal);
  update public.products set stock=stock-p_quantity where id=v_product.id;
  return jsonb_build_object('order_number',v_order_number,'order_id',v_order_id,'shipping_fee',v_shipping,'subtotal',v_subtotal,'discount',v_discount,'total',v_total);
end;
$$;

revoke all on function public.place_order_by_city(uuid,integer,text,text,text,text,text) from public;
grant execute on function public.place_order_by_city(uuid,integer,text,text,text,text,text) to anon, authenticated;
