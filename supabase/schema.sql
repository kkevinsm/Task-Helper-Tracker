-- =============================================================
-- urtaskhelper — Supabase schema
-- Jalankan seluruh file ini di Supabase Dashboard → SQL Editor.
-- Aman dijalankan ulang (idempotent sebisa mungkin).
-- =============================================================

-- ---------- Status enum ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('pending', 'in_progress', 'completed', 'revision', 'revision_completed', 'cancelled');
  else
    alter type public.order_status add value if not exists 'revision';
    alter type public.order_status add value if not exists 'revision_completed';
  end if;
end$$;

-- ---------- Admin allowlist ----------
-- Hanya email yang terdaftar di sini yang dianggap admin.
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Tidak ada policy => tidak bisa dibaca/ditulis lewat API publik.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Tracking code generator (ADA-001, ADA-002, ...) ----------
create sequence if not exists public.order_code_seq start 1;

create or replace function public.next_tracking_code()
returns text
language sql
volatile
as $$
  select 'ADA-' || lpad(nextval('public.order_code_seq')::text, 3, '0');
$$;

-- ---------- Orders ----------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  tracking_code    text not null unique default public.next_tracking_code(),
  client_name      text not null,
  client_contact   text,
  title            text not null,
  category         text not null default 'Lainnya',
  status           public.order_status not null default 'pending',
  deadline         date,
  notes            text,
  admin_notes      text,
  price            integer,
  result_file_path text,
  result_file_name text,
  result_link      text,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- updated_at + timestamps otomatis
create or replace function public.orders_before_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'in_progress' and old.status is distinct from 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status in ('completed', 'revision_completed') and old.status not in ('completed', 'revision_completed') then
    new.completed_at := now();
  elsif new.status not in ('completed', 'revision_completed') then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_before_update on public.orders;
create trigger trg_orders_before_update
before update on public.orders
for each row execute function public.orders_before_update();

-- ---------- RLS: hanya admin yang bisa akses tabel langsung ----------
alter table public.orders enable row level security;

drop policy if exists "admin full access" on public.orders;
create policy "admin full access" on public.orders
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- Public tracking (RPC) ----------
-- Publik tidak bisa SELECT tabel orders. Mereka hanya bisa memanggil fungsi ini
-- dengan kode antrean yang tepat. Nama klien disamarkan, catatan admin & harga
-- tidak pernah dikirim, dan info file hasil hanya muncul saat status 'completed'.
create or replace function public.mask_name(full_name text)
returns text
language sql
immutable
as $$
  select string_agg(
    case
      when length(w) <= 1 then w
      when length(w) = 2 then left(w, 1) || '*'
      else left(w, 1) || repeat('*', length(w) - 2) || right(w, 1)
    end,
    ' '
  )
  from regexp_split_to_table(trim(full_name), '\s+') as w;
$$;

drop function if exists public.get_public_order(text);
create or replace function public.get_public_order(code text)
returns table (
  tracking_code text,
  client_name   text,
  title         text,
  category      text,
  status        public.order_status,
  deadline      date,
  notes         text,
  has_file      boolean,
  result_file_name text,
  result_link   text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz,
  updated_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.tracking_code,
    public.mask_name(o.client_name),
    o.title,
    o.category,
    o.status,
    o.deadline,
    o.notes,
    (o.status in ('completed', 'revision_completed') and o.result_file_path is not null),
    case when o.status in ('completed', 'revision_completed') then o.result_file_name end,
    case when o.status in ('completed', 'revision_completed') then o.result_link end,
    o.started_at,
    o.completed_at,
    o.created_at,
    o.updated_at
  from public.orders o
  where upper(o.tracking_code) = upper(trim(code))
  limit 1;
$$;

revoke all on function public.get_public_order(text) from public;
grant execute on function public.get_public_order(text) to anon, authenticated;

-- ---------- Storage bucket untuk file hasil (private) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('results', 'results', false, 52428800) -- 50 MB
on conflict (id) do nothing;

drop policy if exists "admin manage results" on storage.objects;
create policy "admin manage results" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'results' and public.is_admin())
  with check (bucket_id = 'results' and public.is_admin());
-- Klien mengunduh lewat signed URL yang dibuat server (/api/download/[code])
-- hanya ketika status pesanan 'completed'.

-- =============================================================
-- LANGKAH TERAKHIR: daftarkan email admin Anda (ganti emailnya!)
-- =============================================================
-- insert into public.admins (email) values ('emailanda@example.com')
-- on conflict do nothing;

