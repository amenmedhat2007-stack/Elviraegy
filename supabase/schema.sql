-- Elvira Supabase schema (fresh install)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  gender text not null default 'female' check (gender in ('male','female')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique,
  description text not null default '',
  collection text not null default '',
  notes text not null default '',
  sku text unique,
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  badge text,
  image_url text,
  gender text not null default 'female' check (gender in ('male','female')),
  category_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id=1),
  logo_url text,
  hero_eyebrow text not null default 'ELVIRA · EAU DE PARFUM',
  hero_title text not null default 'FEEL INVISIBLE, LEAVE A TRAIL',
  hero_description text not null default 'Timeless elegance captured in every drop.',
  hero_button text not null default 'DISCOVER COLLECTION',
  intro_title text not null default '',
  intro_text text not null default '',
  story_title text not null default 'ELVIRA POLICY',
  story_text text not null default '',
  instagram_url text not null default '#',
  facebook_url text not null default '#',
  tiktok_url text not null default '#',
  support_whatsapp text not null default '',
  support_phone text not null default '',
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) between 3 and 254 and email = lower(email) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  product_id uuid not null references public.products(id) on delete cascade,
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (discount_type <> 'percent' or discount_value <= 100)
);

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fee numeric(12,2) not null check (fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null check (length(trim(customer_name)) between 2 and 160),
  whatsapp text not null check (length(trim(whatsapp)) between 6 and 30),
  phone text not null check (length(trim(phone)) between 6 and 30),
  address text not null check (length(trim(address)) between 5 and 500),
  city text not null check (length(trim(city)) between 2 and 120),
  shipping_zone_id uuid references public.shipping_zones(id) on delete restrict,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  original_unit_price numeric(12,2) not null check (original_unit_price >= 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  offer_title text,
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  record_id text,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create index if not exists products_gender_idx on public.products(gender);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_created_at_idx on public.products(created_at desc);
create index if not exists products_stock_idx on public.products(stock);
create index if not exists product_images_product_id_idx on public.product_images(product_id,sort_order);
create index if not exists offers_product_id_idx on public.offers(product_id);
create index if not exists offers_active_dates_idx on public.offers(active,starts_at,ends_at);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists audit_logs_changed_at_idx on public.audit_logs(changed_at desc);

insert into public.site_settings(id) values(1) on conflict (id) do nothing;
insert into public.categories(name,slug,gender) values
  ('Female Fragrance','female-fragrance','female'),
  ('Male Fragrance','male-fragrance','male')
on conflict (name) do update set gender=excluded.gender;
insert into public.shipping_zones(name,fee) values
  ('Greater Cairo',80),('Nile Delta',100),('Upper Egypt',120),('Remote Areas',150)
on conflict (name) do update set fee=excluded.fee;

create or replace function public.set_updated_at() returns trigger
language plpgsql security invoker as $$ begin new.updated_at=now(); return new; end; $$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at before update on public.offers for each row execute function public.set_updated_at();
drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at before update on public.site_settings for each row execute function public.set_updated_at();
drop trigger if exists shipping_zones_set_updated_at on public.shipping_zones;
create trigger shipping_zones_set_updated_at before update on public.shipping_zones for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id) values(new.id) on conflict do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(actor_id,table_name,action,record_id,old_data,new_data)
  values(auth.uid(),TG_TABLE_NAME,TG_OP,coalesce(new.id,old.id)::text,to_jsonb(old),to_jsonb(new));
  return coalesce(new,old);
end; $$;

create or replace function public.active_offer_for_product(p_id uuid)
returns table(title text, discount_type text, discount_value numeric)
language sql stable security definer set search_path=public as $$
  select o.title,o.discount_type,o.discount_value
  from public.offers o
  where o.product_id=p_id and o.active=true
    and (o.starts_at is null or o.starts_at<=now())
    and (o.ends_at is null or o.ends_at>=now())
  order by o.created_at desc limit 1;
$$;

create or replace function public.place_order(
  p_product_id uuid,
  p_quantity integer,
  p_customer_name text,
  p_whatsapp text,
  p_phone text,
  p_address text,
  p_city text,
  p_shipping_zone_id uuid
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
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
begin
  if p_quantity < 1 then raise exception 'Quantity must be at least 1'; end if;
  if length(trim(p_customer_name))<2 then raise exception 'Please enter your full name'; end if;
  if length(trim(p_whatsapp))<6 then raise exception 'Please enter a valid WhatsApp number'; end if;
  if length(trim(p_phone))<6 then raise exception 'Please enter a valid phone number'; end if;
  if length(trim(p_address))<5 then raise exception 'Please enter your delivery address'; end if;
  if length(trim(p_city))<2 then raise exception 'Please enter your city or area'; end if;

  select * into v_zone from public.shipping_zones where id=p_shipping_zone_id and active=true;
  if not found then raise exception 'Please select a valid shipping region'; end if;

  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if v_product.stock < p_quantity then raise exception 'Only % units are available', v_product.stock; end if;

  select * into v_offer from public.offers where product_id=v_product.id and active=true
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())
    order by created_at desc limit 1;

  v_original:=v_product.price;
  v_unit:=v_original;
  if found then
    if v_offer.discount_type='percent' then v_unit:=greatest(0,v_original*(1-v_offer.discount_value/100));
    else v_unit:=greatest(0,v_original-v_offer.discount_value); end if;
  end if;
  v_discount:=greatest(0,(v_original-v_unit)*p_quantity);
  v_subtotal:=v_unit*p_quantity;
  v_shipping:=v_zone.fee;
  v_total:=v_subtotal+v_shipping;
  v_order_number:='ELV-'||to_char(now(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.orders(order_number,customer_name,whatsapp,phone,address,city,shipping_zone_id,subtotal,discount,shipping_fee,total)
  values(v_order_number,trim(p_customer_name),trim(p_whatsapp),trim(p_phone),trim(p_address),trim(p_city),v_zone.id,v_subtotal,v_discount,v_shipping,v_total)
  returning id into v_order_id;

  insert into public.order_items(order_id,product_id,product_name,quantity,original_unit_price,unit_price,discount_amount,offer_title,line_total)
  values(v_order_id,v_product.id,v_product.name,p_quantity,v_original,v_unit,v_discount,case when v_offer.id is null then null else v_offer.title end,v_subtotal);

  update public.products set stock=stock-p_quantity where id=v_product.id;

  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'discount',v_discount,'shipping_fee',v_shipping,'total',v_total);
end;
$$;

drop trigger if exists products_audit on public.products;
create trigger products_audit after insert or update or delete on public.products for each row execute function public.write_audit_log();
drop trigger if exists categories_audit on public.categories;
create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.write_audit_log();
drop trigger if exists offers_audit on public.offers;
create trigger offers_audit after insert or update or delete on public.offers for each row execute function public.write_audit_log();
drop trigger if exists site_settings_audit on public.site_settings;
create trigger site_settings_audit after insert or update or delete on public.site_settings for each row execute function public.write_audit_log();
drop trigger if exists shipping_zones_audit on public.shipping_zones;
create trigger shipping_zones_audit after insert or update or delete on public.shipping_zones for each row execute function public.write_audit_log();
drop trigger if exists orders_audit on public.orders;
create trigger orders_audit after insert or update or delete on public.orders for each row execute function public.write_audit_log();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.site_settings enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.offers enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.audit_logs enable row level security;

do $$ declare r record; begin
  for r in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('profiles','categories','products','product_images','site_settings','newsletter_subscribers','offers','shipping_zones','orders','order_items','audit_logs') loop
    execute format('drop policy if exists %I on public.%I',r.policyname,r.tablename);
  end loop;
end $$;

create policy "public read categories" on public.categories for select using (true);
create policy "public read products" on public.products for select using (true);
create policy "public read product images" on public.product_images for select using (true);
create policy "public read site settings" on public.site_settings for select using (true);
create policy "public read active offers" on public.offers for select using (active=true or public.is_admin());
create policy "public read shipping zones" on public.shipping_zones for select using (active=true);
create policy "admin manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage product images" on public.product_images for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage site settings" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage offers" on public.offers for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage shipping zones" on public.shipping_zones for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage orders" on public.orders for select using (public.is_admin());
create policy "admin update orders" on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "admin read order items" on public.order_items for select using (public.is_admin());
create policy "admin read profiles" on public.profiles for select using (auth.uid()=id or public.is_admin());
create policy "newsletter insert" on public.newsletter_subscribers for insert with check (email=lower(email));
create policy "admin read newsletter" on public.newsletter_subscribers for select using (public.is_admin());
create policy "admin read audit logs" on public.audit_logs for select using (public.is_admin());

grant execute on function public.place_order(uuid,integer,text,text,text,text,text,uuid) to anon, authenticated;

insert into storage.buckets(id,name,public) values('elvira-media','elvira-media',true)
on conflict (id) do update set public=true;
drop policy if exists "public media read" on storage.objects;
drop policy if exists "admin media upload" on storage.objects;
drop policy if exists "admin media update" on storage.objects;
drop policy if exists "admin media delete" on storage.objects;
create policy "public media read" on storage.objects for select using (bucket_id='elvira-media');
create policy "admin media upload" on storage.objects for insert with check (bucket_id='elvira-media' and public.is_admin());
create policy "admin media update" on storage.objects for update using (bucket_id='elvira-media' and public.is_admin()) with check (bucket_id='elvira-media' and public.is_admin());
create policy "admin media delete" on storage.objects for delete using (bucket_id='elvira-media' and public.is_admin());
