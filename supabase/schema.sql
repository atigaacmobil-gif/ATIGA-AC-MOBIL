-- ATIGA AC MOBIL: skema database, autentikasi, peran, dan keamanan
-- Jalankan seluruh isi file ini di Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'pegawai' check (role in ('admin', 'pegawai')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_records (
  id uuid primary key default gen_random_uuid(),
  collection text not null check (collection in ('customers','vehicles','jobs','services','products','transactions','expenses','settings')),
  record_id text not null,
  payload jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection, record_id)
);

create index if not exists app_records_collection_idx on public.app_records(collection);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists app_records_set_updated_at on public.app_records;
create trigger app_records_set_updated_at before update on public.app_records
for each row execute function public.set_updated_at();

-- Setiap akun Auth baru otomatis mendapat profil Pegawai. Admin pertama dipromosikan manual di bawah.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'pegawai',
    true
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_atiga_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true limit 1;
$$;

create or replace function public.current_atiga_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active = true);
$$;

alter table public.profiles enable row level security;
alter table public.app_records enable row level security;

-- Hak akses SQL dasar; kebijakan RLS di bawah tetap membatasi baris dan peran.
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.app_records to authenticated;

-- Profil: pengguna hanya dapat melihat profil sendiri; Admin dapat melihat dan mengubah semua profil.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.current_atiga_role() = 'admin');

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
for update to authenticated
using (public.current_atiga_role() = 'admin')
with check (public.current_atiga_role() = 'admin');

-- Admin dapat membaca semua data. Pegawai hanya membaca data operasional yang diperlukan.
drop policy if exists "records_select_by_role" on public.app_records;
create policy "records_select_by_role" on public.app_records
for select to authenticated
using (
  public.current_atiga_active()
  and (
    public.current_atiga_role() = 'admin'
    or collection in ('customers','vehicles','jobs','services','products')
  )
);

-- Pegawai boleh membuat/memperbarui pelanggan, kendaraan, dan uraian pekerjaan.
-- Data keuangan, pengaturan, layanan, dan produk hanya dapat diubah Admin.
drop policy if exists "records_insert_by_role" on public.app_records;
create policy "records_insert_by_role" on public.app_records
for insert to authenticated
with check (
  public.current_atiga_role() = 'admin'
  or (public.current_atiga_role() = 'pegawai' and collection in ('customers','vehicles','jobs'))
);

drop policy if exists "records_update_by_role" on public.app_records;
create policy "records_update_by_role" on public.app_records
for update to authenticated
using (
  public.current_atiga_role() = 'admin'
  or (public.current_atiga_role() = 'pegawai' and collection in ('customers','vehicles','jobs'))
)
with check (
  public.current_atiga_role() = 'admin'
  or (public.current_atiga_role() = 'pegawai' and collection in ('customers','vehicles','jobs'))
);

-- Hanya Admin yang dapat menghapus data.
drop policy if exists "records_delete_admin" on public.app_records;
create policy "records_delete_admin" on public.app_records
for delete to authenticated
using (public.current_atiga_role() = 'admin');

-- Aktifkan Realtime untuk sinkronisasi antarperangkat.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_records'
  ) then
    alter publication supabase_realtime add table public.app_records;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- PENTING: setelah akun Admin pertama dibuat di Authentication > Users,
-- jalankan perintah ini dengan email akun Admin yang benar:
-- update public.profiles set role = 'admin' where email = 'email-admin-anda@example.com';
